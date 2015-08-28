var TogglClient = require('toggl-api');
var slackAPI = require('slackbotapi');
var moment = require('moment');
var inputParser = require('./inputParser.js');
var response = require('./response.js');


// A var to hold to toggl object
var toggl;

// We need to keep track of our toggl settings
var togglSettings = {
  apiToken: null,
}

// Initialize slack
var slack = new slackAPI({
  // Find the API token for your bot here: https://my.slack.com/services/new/bot
  'token': 'YOUR TOKEN HERE',
	'logging': true
});

// Some vars to keep track of the bot's information
var my_username, my_uid;

// Keep track of users that have been onboarded
var users = [];

// Call auth test in order to get the bot's UID
slack.reqAPI('auth.test', {}, function(data) {
  my_username = new RegExp('<@' + data.user_id + '>', 'gi');
  my_uid = data.user_id;
});

slack.on('message', function(data) {
  // If no text, return
	if(typeof data.text == 'undefined') return;
  // If it's not a direct message, return
  if(data.channel[0] != 'D') return;
  // If it's a message from the bot itself, return
  if(data.user == my_uid) return;

  // Initialize response template wrapper
  res = new response(slack, data);

  // Check to see if this user has interacted with the bot before
  var user = slack.getUser(data.user);
  if(users[user.name] == undefined) {
    // If they haven't, we need to spin them up a record to keep track of
    // their state
    var record = {
      state: 'brand_new',
      onboarded: false
    };
  } else {
    var record = users[user.name];
  };

  if(record.state == 'brand_new'){
    // We update the state and return our greeeting message
    // asking for authentication
    record.state = 'needs_authentication';
    users[user.name] = record;
    return res.greeting();
  } else if(record.state == 'needs_authentication'){
    // We do some simple validation to make sure the
    // message form the user is an API key
    if(data.text.length !== 32) return res.badAPIKey(slack, data);

    togglSettings['apiToken'] = data.text;

    // We attach our toggl Api instance directly to the record object,
    // memoizing it in a way
    record.toggl = new TogglClient(togglSettings);
    
    //Now that we have the API key, we can show a list of workspaces for the user
    //to choose
    record.toggl.getWorkspaces(function(err, workspaces){
      // Return without the normal wrappers if there is an error
      if(err) return slack.sendMsg(data.channel, err.toJSONString());

      record.state = 'workspace_selection';

      // Process the workspaces into something we can use with the parser
      var workspaceCommands = workspaces.map(function(workspace){
        // Reformat each object in the workspace
        var reformatted = {};
        reformatted = { 
          name: workspace.name,
          id: workspace.id,
          type: 'workspace'
        };
        return reformatted;
      });

      record.inputParser = new inputParser();
      // Add the commands
      record.inputParser.addCommands(workspaceCommands);
      users[user.name] = record;
      return res.workspaceSelection(workspaces);
    });
  } else if(record.state == 'workspace_selection'){
    // Figure out the workspace ID
    var workspace = record.inputParser.matchType('workspace', data.text);
    // If we can't figure it out, ask again
    if(workspace == undefined)
      return slack.sendMsg(data.channel, "Sorry, I don't understand");

    slack.sendMsg(data.channel, "Welcome aboard!");
    // Hydrate the command vocabulary with projects
    record.toggl.getWorkspaceProjects(workspace.id,
        { active: true},
        function(err, projects) {
          if(err) return slack.sendMsg(data.channel, err.toJSONString());
          // Reformat each project into a command
          var projectCommands = projects.map(function(project){
            // Reformat each object in the workspace
            var reformatted = {};
            reformatted = { 
              name: project.name,
              id: project.id,
              type: 'project'
            };
            return reformatted;
          });
          record.inputParser.addCommands(projectCommands);
        });

    // As the hydration callbacks are still running, let's just display
    // the help screen to complete the onboarding
    record.state = 'onboarded';
    record.onboarded = true; 
    record.workspace_id = workspace.id;
    users[user.name] = record;
    return res.help();
  };


  // Now that the user is onboarded, this will be our main loop
  if(record.onboarded){
    var parsedQuery = record.inputParser.query(data.text);
    if(parsedQuery.type == 'list'){
      var projects = record.inputParser.commandVocabulary.filter(function(command) {
        if(command.type == 'project') return true
      });

      return res.listProjects(projects);
    } else if(parsedQuery.type == 'view') {
      var project = record.inputParser.matchType('project', parsedQuery.args[0]);
      if(project == undefined)
        return slack.sendMsg(data.channel, "Sorry, I don't understand");
      // Run a weekly report
      var since = moment().startOf('week').toDate();
      record.toggl.weeklyReport({
        user_agent: "YOUR EMAIL ADDRESS HERE",
        workspace_id: record.workspace_id,
        project_ids: project.id,
        since: moment(since).format('YYYY-MM-DD'),
      }, function(err, report){
        if(report.data.length == 0)
          return slack.sendMsg(data.channel, "There is no activity for this project");
        else
          return res.viewProject(report.data[0]);
      });
    };

  };

});
