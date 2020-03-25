//Webex Bot Starter - featuring the webex-node-bot-framework - https://www.npmjs.com/package/webex-node-bot-framework

var framework = require('webex-node-bot-framework');
var webhook = require('webex-node-bot-framework/webhook');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json());
app.use(express.static('images'));
const config = require("./config.json");

// init framework
var framework = new framework(config);
framework.start();
console.log("Starting framework, please wait...");

framework.on("initialized", function () {
  console.log("framework is all fired up! [Press CTRL-C to quit]");
});

// A spawn event is generated when the framework finds a space with your bot in it
// If actorId is set, it means that user has just added your bot to a new space
// If not, the framework has discovered your bot in an existing space
framework.on('spawn', (bot, id, actorId) => {
  if (!actorId) {
    // don't say anything here or your bot's spaces will get
    // spammed every time your server is restarted
    console.log(`While starting up, the framework found our bot in a space called: ${bot.room.title}`);
  } else {
    // When actorId is present it means someone added your bot got added to a new space
    let botName = bot.person.displayName;
    var msg = 'My name is '+botName+', you can say `list` or `help` to get a list of things I can help with.';
    bot.webex.people.get(actorId).then((user) => {
      msg = `Hello ${user.displayName}. ${msg}`;
    }).catch((e) => {
      console.error(`Failed to lookup user details in framwork.on("spawn"): ${e.message}`);
      msg = `Hello. ${msg}`;
    }).finally(() => {
      // Say hello, and tell users what you do!
      if (bot.isDirect) {
        bot.say('markdown', msg);
      } else {
        msg += `\n\nDon't forget, in order for me to see your messages in this group space, be sure to *@mention* ${botName}.`;
        bot.say('markdown', msg);
      }
    });
  }
});


//Process incoming messages

let responded = false;
/* On mention with command
ex User enters @botname help, the bot will write back in markdown
*/
framework.hears(/ |list|help|what can i (do|say)|what (can|do) you do/i, function (bot, trigger) {
  responded = true;
  bot.say(`Hello ${trigger.person.displayName}.`)
      .then(() => sendHelp(bot))
      .catch((e) => console.error(`Problem in help hander: ${e.message}`));
});

/* On mention with bot data
ex User enters @botname 'space' phrase, the bot will provide details about that particular space
*/
framework.hears('space', function (bot) {
  responded = true;
  let roomTitle = bot.room.title;
  let spaceID = bot.room.id;
  let roomType = bot.room.type;
  let outputString = `The title of this space: ${roomTitle} \n\n The roomID of this space: ${spaceID} \n\n The type of this space: ${roomType}`;
  console.log(outputString);
  bot.say("markdown", outputString)
      .catch((e) => console.error(`bot.say failed: ${e.message}`));
});

// Buttons & Cards data
let cardJSON =
    {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: 'AdaptiveCard',
      version: '1.0',
      body:
          [{
            type: 'ColumnSet',
            columns:
                [{
                  type: 'Column',
                  width: '5',
                  items:
                      [{
                        type: 'Image',
                        url: 'Your avatar appears here!',
                        size: 'large',
                        horizontalAlignment: "Center",
                        style: 'person'
                      },
                        {
                          type: 'TextBlock',
                          text: 'Your name will be here!',
                          size: 'medium',
                          horizontalAlignment: "Center",
                          weight: 'Bolder'
                        },
                        {
                          type: 'TextBlock',
                          text: 'And your email goes here!',
                          size: 'small',
                          horizontalAlignment: "Center",
                          isSubtle: true,
                          wrap: false
                        }]
                }]
          }]
    };

/* On mention with card example
ex User enters @botname 'me' phrase, the bot will produce a personalized card - https://developer.webex.com/docs/api/guides/cards
*/
framework.hears('me', function (bot, trigger) {
  responded = true;
  let avatar = trigger.person.avatar;
  cardJSON.body[0].columns[0].items[0].url = (avatar) ? avatar : `${config.webhookUrl}/missing-avatar.jpg`;
  cardJSON.body[0].columns[0].items[1].text = trigger.person.displayName;
  cardJSON.body[0].columns[0].items[2].text = trigger.person.emails[0];
  bot.sendCard(cardJSON, 'This is customizable fallback text for clients that do not support buttons & cards');
});

/* On mention with unexpected bot command
   Its a good practice is to gracefully handle unexpected input
*/
framework.hears(/.*/, function (bot, trigger) {
  // This will fire for any input so only respond if we haven't already
  if (!responded) {
    console.log(`catch-all handler fired for user input: ${trigger.text}`);
    bot.say(`I am sorry I can't help with "${trigger.text}" by the moment, please type help for an available list of thing I can help with.`)
        .then(() => sendHelp(bot))
        .catch((e) => console.error(`Problem in the unexepected command hander: ${e.message}`));
  }
  responded = false;
});

function sendHelp(bot) {
  bot.say("markdown", 'These are the things I can help with:', '\n\n ' +
      '1. **COVID-19 Offerings**   (learn more about Sentinel\'s offerings for COVID-19) \n' +
      '2. **Workshop details**  (information available for workshops) \n' +
      '3. **Schedule a workshop**  \n' +
      '3. **me**  (show your personal info)\n' +
      '3. **space**  (show information about this group)\n' +
      '3. **help**  (what you are reading now)\n' +
      'How can I help you?');
}


//Server config & housekeeping
// Health Check
app.get('/', function (req, res) {
  res.send(`I'm alive.`);
});

app.post('/', webhook(framework));

var server = app.listen(config.port, function () {
  framework.debug('framework listening on port %s', config.port);
});

// gracefully shutdown (ctrl-c)
process.on('SIGINT', function () {
  framework.debug('stoppping...');
  server.close();
  framework.stop().then(function () {
    process.exit();
  });
});
