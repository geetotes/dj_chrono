// Input Parser Module
require("string_score");

// Init
var inputParser = function() {
  this.commandVocabulary = [];
};

// Add commands to the command vocab
inputParser.prototype.addCommands = function (commandsArray) {
  console.log(this.commandVocabulary);
  this.commandVocabulary = this.commandVocabulary.concat(commandsArray);
  return this;
}

// The parser is expecting a query
// so it's called by parse.entityQuery
inputParser.prototype.query = function(inputString) {
  // Split the input string
  inputSplit = inputString.split(" ");
  var queryType = inputSplit.shift();
  if(queryType != 'view' && queryType != 'list'){
    throw 'Invalid Query Type';
  };

  return {
    type: queryType,
    args: inputSplit
  }

};

// Return the command object of that matches the input string and
// command type
inputParser.prototype.matchType = function(commandType, inputString){
  var availableCommands = this.commandVocabulary.filter(function(command){
    // Only return the commands that match
    if(command.type == commandType){
      // Do a fuzzy match provided by string_score
      if(command.name.score(inputString) > 0.5) return command;
      }
    });

  // TODO; This should throw an error or ask the user for more info
  // if there are more than one match
  return availableCommands[0];

};

module.exports = inputParser;
