const twilio = require('twilio')

const client = twilio(
	process.env.TWILIO_ACCOUNT_SID,
	process.env.TWILIO_AUTH_TOKEN
)

const conferenceHelper = require('./helpers/conference-helper.js')

module.exports.getConference = function (req, res) {
	const payload = {}

	conferenceHelper
		.getConferenceByName('conf_' + req.params.sid)
		.then(conference => {
			payload.conferenceSid = conference.sid

			return conferenceHelper.getConferenceParticipants(conference.sid)
		})
		.then(participants => {
			const list = participants.filter(function (callSid) {
				if (callSid !== req.body.callSid) {
					return callSid
				}
			})

			if (list.length !== 0) {
				payload.callSid = list[0]
			}

			res.json(payload)
		})
		.catch(error => {
			res.status(500).end()
		})
}

module.exports.call = function (req, res) {
	//let name = 'conf_' + req.body.CallSid
	let name = 'room1234'

	const twiml = new twilio.twiml.VoiceResponse()
	//const dial = twiml.dial({ callerId: req.configuration.twilio.callerId })
	 

	const dial = twiml.dial().conference(
		/*{
			endConferenceOnExit: true,
			statusCallbackEvent: 'join',
			statusCallback: `/api/phone/call/${req.body.CallSid}/add-participant/${encodeURIComponent(req.body.phone)}`
		},*/
		name
	)

	res.set({
		'Content-Type': 'application/xml',
		'Cache-Control': 'public, max-age=0',
	})

	res.send(twiml.toString())
}

module.exports.addParticipant = function (req, res) {

	if (req.body.CallSid === req.params.sid) {
		/* the agent joined, we now call the phone number and add it to the conference */
		client
			.conferences('conf_' + req.params.sid)
			.participants.create({
				to: req.params.phone,
				from: req.configuration.twilio.callerId,
				earlyMedia: true,
				endConferenceOnExit: true
			}).then(participant => {
				res.status(200).end()
			})
			.catch(error => {
				console.error(error)
				res.status(500).end()
			})

	} else {
		res.status(200).end()
	}

}

module.exports.getOnGoingConferences = function(req,res){
	console.log('INside getOnGoingConferences');
	const options = {
		status: 'in-progress'
	}	
		async.waterfall([
			function(callback){
				client.conferences
			.list(options)
			.then(conferences => {
					if (conferences.length === 0) {
						res.json('NOT_FOUND')
					} else {
						callback(null,conferences)
					}
				})
			},
			function(conferences,callback){
				getCallerName(conferences)
					.then(result=>{
						callback(null,result)
					})
			}
		]),
		function(err,callback){
			if(!err){
				console.log('conferences List After ::', JSON.stringify(result));
				res.json(result);
			}
			else	
				res.status(500).end();
		}
		/*client.conferences
			.list(options)
			.then(conferences => {
				if (conferences.length === 0) {
					res.json('NOT_FOUND')
				} else {
					console.log('conferences List ::', JSON.stringify(conferences));
					conferences.forEach(conference => {
						conferenceHelper.getConferenceParticipants(conference.sid)
						.then(participants=>{
							console.log('Participants List:',participants);
							getCallerName(participants)
							.then(caller =>{
								console.log('Caller name',caller,conference.sid);
								conference.agent = caller;
								console.log('Caller name',caller,conference.sid,conference.agent);								
							}).catch(error => {
								console.log(error)
							})
						})
					});
					getCallerName(conferences)
					.then(result=>{
						console.log('conferences List After ::', JSON.stringify(result));
						res.json(result);
					})
					//console.log('conferences List After ::', JSON.stringify(conferences));
					//res.json(conferences);
				}
			})
			.catch(error => {
				res.status(500).end();
			})*/
}

getCallerName = function(conferences){
	return new Promise((resolve,reject)=>{
		conferences.forEach(conference => {
			conferenceHelper.getConferenceParticipants(conference.sid)
			.then(ParticipantsList=>{
				console.log('Participants List:',ParticipantsList);
					ParticipantsList.forEach(participant =>{
					client.calls(participant)
					  .fetch()
					  .then(call => {
						  console.log('Participant::',participant,';Call to:',call.to)
						  let callTo = call.to;
						  if(callTo.indexOf('client')!=-1){
							  console.log('condition pass');
							callTo = callTo.substring(callTo.indexOf(':')+1,callTo.length);
							console.log('condition pass::',callTo);
							conference.agent = callTo;
						  }
						})
					})
		
				})
			})
		resolve(conferences);
		}).catch(error => {
			reject(error)
	})
}

module.exports.hold = function (req, res) {

	client
		.conferences(req.body.conferenceSid)
		.participants(req.body.callSid)
		.update({ hold: req.body.hold })
		.then(participant => {
			res.status(200).end()
		})
		.catch(error => {
			res.status(500).end()
		})

}
