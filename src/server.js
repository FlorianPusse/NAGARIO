var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
io.set('transports', ['websocket']);

var conf = require('./config.json');

server.listen(conf.port);

app.use('/static', express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/home.html');
});

var currentPlayers = {};
var playerToSocket = {};
var idGenerator = 0;

function addPlayer(socket){
	var mapWidth = 10000;
	var mapHeight = 10000;
	var x = Math.floor(Math.random() * mapWidth);
	var y = Math.floor(Math.random() * mapHeight);
	
	// http://stackoverflow.com/questions/1484506/random-color-generator-in-javascript
	var color = "#"+((1<<24)*Math.random()|0).toString(16);
	
	socket._id = idGenerator;
	playerToSocket[idGenerator] = socket;
	currentPlayers[socket._id] = {playerId : idGenerator, x : x, y : y, size: 30, color: color};
	console.log("New player: " + idGenerator++);
}

function removePlayer(socket){
	var playerId = socket._id;
	console.log("Player left: " + playerId);
	delete currentPlayers[playerId];
	delete playerToSocket[playerId];
		
	// Announce that player left
	io.sockets.emit('NAGARIO', { type: 'LEFT', playerId : playerId });
}

function handleMessage(socket,message){
	switch(message.type){
		case "UPDATE":
			currentPlayers[socket._id] = message;
			socket.broadcast.emit('NAGARIO', message);
			break;
		case "EAT PLAYER":
			var eatenPlayer = currentPlayers[message.id];
			var playerSocket = playerToSocket[message.id];
			removePlayer(playerSocket);
			playerSocket.emit('NAGARIO', { type : 'DEAD', id: socket._id });
			break;
		case "EAT SCRAP":
			break;
		default:
	}
}

io.sockets.on('connection', function (socket) {
	// Add player to playerlist
	addPlayer(socket);
	
	// welcome new player
	var freshPlayer = currentPlayers[socket._id];
	freshPlayer.type = "WELCOME";
    socket.emit('NAGARIO', freshPlayer);
	
	// tell the player who is already on the server
	for(var playerId in currentPlayers){
		if (!currentPlayers.hasOwnProperty(playerId) || playerId == socket._id)
			continue;
		
		var p = currentPlayers[playerId];
		p.type = "PLAYER JOINED";
		socket.emit('NAGARIO', p);
	}
	
	var p = currentPlayers[socket._id];
	p.type = "PLAYER JOINED";
	socket.emit('NAGARIO', p);
	
	// announce new player 
	socket.broadcast.emit('NAGARIO', p );
	
	// Player left
	socket.on('disconnect', function(){
		removePlayer(socket);
	});

	// Player sent new message
    socket.on('NAGARIO', function (message) {
		handleMessage(socket,message);
    });
});