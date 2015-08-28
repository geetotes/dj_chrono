// Response Display module

var dustfs = require('dustfs');
var moment = require('moment');

//Init
var response = function(slack, data) {
  this.slack = slack;
  this.data = data;
  // Load up the dust templates
  dustfs.dirs('templates');
};

response.prototype.slackWrapper = function(err, out) {
  this.slack.sendMsg(this.data.channel, out);
};

response.prototype.greeting = function(){
  username = '@' + this.slack.getUser(this.data.user).name;
  dustfs.render('greeting.dust', {username: username}, this.slackWrapper.bind(this));
};

response.prototype.badAPIKey = function(){
  dustfs.render('badAPIKey.dust', {}, this.slackWrapper.bind(this));
};

response.prototype.listProjects = function(projects){
  dustfs.render('listProjects.dust', {
    projects_length: projects.length,
    projects: projects
  }, this.slackWrapper.bind(this));
};

response.prototype.help = function(){
  dustfs.render('help.dust', {}, this.slackWrapper.bind(this));
};

response.prototype.viewProject = function(report) {
  var project = report.title.project;
  var totalHours = report.totals.reduce(function(a,b){
    return a + b;
  });
  dustfs.render('viewProject.dust', {
    project: project,
    totalHours: moment.duration(totalHours)
  }, this.slackWrapper.bind(this));
};

response.prototype.workspaceSelection = function(workspaces){
  dustfs.render('workspaceSelection.dust', {
    workspace_length: workspaces.length,
    workspaces: workspaces
  }, this.slackWrapper.bind(this));
};

module.exports = response;
