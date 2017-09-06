'use strict'
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const pg = require('pg'); //postgresql
const querystring = require('querystring');

const app = express()

//config variables
const connectionString = process.env.DATABASE_URL // || 'postgres://localhost:5432/todo';

app.set('port', (process.env.PORT || 5000))
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json())

//index
app.get('/', function (req, res) {
	res.send('566348112')
})

/* you will need this to setup a webhook with the facebook api */
app.get("/webhook", function (req, res) {
  if (req.query["hub.verify_token"] === "penguin") {
    console.log("Verified webhook");
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    console.error("Verification failed. The tokens do not match.");
    res.sendStatus(403);
  }
});

// to post data
app.post('/webhook/', function (req, res) {
	let messaging_events = req.body.entry[0].messaging
	for (let i = 0; i < messaging_events.length; i++) {
		let event = req.body.entry[0].messaging[i]
		let sender = event.sender.id
		if (event.message && event.message.text) {
			let message = event.message.text
			messageHandler(sender, message)
		}
		if (event.postback) {
			let text = JSON.stringify(event.postback)
			sendTextMessage(sender, "Postback received: " +text.substring(0, 200), token)
			continue
		}
	}
	res.sendStatus(200)
})

//sample database request
app.get('/db', function (request, response) {
  pg.connect(connectionString, function(err, client, done) {
    client.query('SELECT * FROM test_table', function(err, result) {
      done();
      if (err)
       { console.error(err); response.send("Error " + err); }
      else
       { response.send({results: result.rows} ); }
    });
  });
});

//store the weight
app.post('/db/weight', (req, res, next) => {
  const results = [];
  // Grab data from http request
  // const data = {text: req.body.text, complete: false};

  console.log(req.body);
  const data = {user_id: req.body.user_id || '123' , weight: req.body.weight || 123, metric: req.body.metric || 'lbs'};
  console.log(data);
  // Get a Postgres client from the connection pool
  pg.connect(connectionString, (err, client, done) => {
    // Handle connection errors
    if(err) {
      done();
      console.log(err);
      return res.status(500).json({success: false, data: err});
    }
    // SQL Query > Insert Data
    client.query('INSERT INTO weight (user_id, weight, metric, message_time) values($1, $2, $3, current_timestamp);',
    [data.user_id, data.weight, data.metric]);
    /*
    // SQL Query > Select Data
    const query = client.query('SELECT * FROM items ORDER BY id ASC');
    // Stream results back one row at a time
    query.on('row', (row) => {
      results.push(row);
    });`
    // After all data is returned, close connection and return results
    query.on('end', () => {
      done();
      return res.json(results);
    });
	*/
	done();
	return res.status(200).json({success: true,message: 'inserted weight record'})
  });
});

const token = process.env.token
function sendTextMessage(sender, text) {
	let messageData = { text:text }
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

function sendGenericMessage(sender) {
	let messageData = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "generic",
				"elements": [{
					"title": "First card",
					"subtitle": "Element #1 of an hscroll",
					"image_url": "http://messengerdemo.parseapp.com/img/rift.png",
					"buttons": [{
						"type": "web_url",
						"url": "https://www.messenger.com",
						"title": "web url"
					}, {
						"type": "postback",
						"title": "Postback",
						"payload": "Payload for first element in a generic bubble",
					}],
				}, {
					"title": "Second card",
					"subtitle": "Element #2 of an hscroll",
					"image_url": "http://messengerdemo.parseapp.com/img/gearvr.png",
					"buttons": [{
						"type": "postback",
						"title": "Postback",
						"payload": "Payload for second element in a generic bubble",
					}],
				}]
			}
		}
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

function messageHandler(sender, message) {
	/*
	Determine how to handle the message
	*/
	let splitmessage = message.toLowerCase().split(' ');

	if (splitmessage.includes('weight') || splitmessage.includes('pounds')) {
		weightTrackingHandler(sender, message)
	} 

	else if (splitmessage.includes('i') && splitmessage.includes('did')) {
		taskTrackingHandler(sender, message)
	}

	else if (splitmessage.includes('feeling') || splitmessage.includes('mood')) {
		moodTrackingHandler(sender, message)
	}

	else if (splitmessage.includes('hi') || splitmessage.includes('hello') || splitmessage.includes('hey')) {
		greetingHandler(sender, message)
	}

	else if (splitmessage.includes('help') || splitmessage.includes('tip') || splitmessage.includes('tips')) {
		helpHandler(sender, message)
	}

	else if (splitmessage.includes('generic')) {
		genericMessageHandler(sender, message)
	}

	else {
	    sendTextMessage(sender, "Sorry, I could not understand what you were saying...");
	    sendTextMessage(sender, "Note: Please type \"help\" to learn how to interact with me!");
	    //sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200) + " Hi Janet.")
	};
}

function genericMessageHandler(sender, message) {
	console.log("welcome to chatbot")
  	sendGenericMessage(sender)
}

function weightTrackingHandler(sender, message) {
	let weight = numberParser(message)
	if (weight == null) {
		sendTextMessage(send, "Please enter a weight between 0 and 10, i.e my mood is X out of 10")
		return
	}
	sendTextMessage(sender, "Got it! Your weight for today has been recorded as: " + String(weight))
	dbStoreWeight(sender, weight);
}

function moodTrackingHandler(sender, message) {
	/*
	Test cases:

	I am feeling very good: Got it! Your mood for today is 10/10
	I am feeling good: 8/10
	I am feeling bad: 3/10
	I am feeling very bad: 1/10
	
	I am feeling like a 7: Got it! Your mood for today is a 7/10
	*/

	let mood = parseInt(numberParser(message));
	if (mood == null) {
		sendTextMessage(send, "Please enter a mood number between 0 and 10, i.e my mood is X out of 10")
		return
	}

	if (mood >= 0 && mood <= 4) {
		message_end = "I hope you feel better soon!"
	} else if (mood > 4 && mood <= 7) {
		message_end = ""
	} else if (mood > 7 && mood <= 10) {
		message_end = "I'm glad you are feeling great today!"
	} else {
		sendTextMessage(send, "Please enter a mood number between 0 and 10, i.e my mood is X out of 10")
		return
	}
	sendTextMessage(sender, "Got it, we have recorded your mood as: " + String(mood) + message_end)
}

function taskTrackingHandler(sender, message) {
	sendTextMessage(sender, "Got it! Your accomplishment for today has been recorded")
}

function greetingHandler(sender, message) {
	let possible_responses = ["Hello!","Greetings!","Hi!","Hola!","Hey!","Bonjour!"];
	let random_index = Math.floor(Math.random()*(possible_responses.length));
	let mymessage = possible_responses[random_index];
	sendTextMessage(sender, mymessage);	
}

function helpHandler(sender, message) {
	let possible_responses = [
	"Type \"My weight is X \" to record your weight for today",
	"Type \"My mood is X out of 10, to record your mood for today",
	"Type \" I did X\" to record your accomplishments for today"
	];

	let random_index = Math.floor(Math.random()*(possible_responses.length));
	let mymessage = possible_responses[random_index];
	sendTextMessage(sender, "Heres a tip: " + mymessage);	
}

app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})


//db request function
function dbStoreWeight(sender, weight) {
	console.log("attempting to post")	
	  const data = {user_id: sender , weight: weight, metric: 'lbs'};
	  console.log(data);
	  // Get a Postgres client from the connection pool
	  pg.connect(connectionString, (err, client, done) => {
	    // Handle connection errors
	    if(err) {
	      done();
	      console.log(err);
	      return {success: false, data: err};
	    }
	    // SQL Query > Insert Data
	    client.query('INSERT INTO weight (user_id, weight, metric, message_time) values($1, $2, $3, current_timestamp);',
	    [data.user_id, data.weight, data.metric]);
		done();
		return {success: true,message: 'inserted weight record'}
	  });
};

function numberParser(message) {
	let numberPattern = /\d+/g;
	return message.match( numberPattern )[0]
}

/* immediate todo list
-- Add postgresql conection
-- submit app for review 
*/


/*
More features to add in the future:

-- Ask some introductory question to learn about the user and collect some initial data
-- After facebook authentication, data mine the user!
-- connect to wit ai
-- postgresql connection

-- create a web portal to display all the analytics that have been gathered

-- in addition to the web portal, also send vizualizations through the chat itself.  For example, after recording the weight, 
-- display a graph of the weight fluctuations over the last two months.

-- connect to wit ai to do general NLP (don't need to do all the work myself)

*/

/* future vision
-- After learning about the user, serve ads and do affiliate marketing.


*/

/*
Other ideas, detect your mood.
*/



