        var self = this;
		var app = self;
		
		// Canvas context (used to draw on) 
		self.context = null;
		
		// Map dimensions
		self.mapWidth = 10000;
		self.mapHeight = 10000;
		self.scrapList = [];
	
		// Movement of the camera
		self.xOffset = 0;
		self.yOffset = 0;
		
		// Dimensions of your screen
		self.screenHeight = 0;
		self.screenWidth = 0;
		
		// Distances between the lines that form the background grid
		self.gridHeight = 25;
		self.gridWidth = 25;

		// Your last known mouse position
		self.mouseX = -1;
		self.mouseY = -1;
		
		// Object representing yourself
		self.player = {};
		
		// The other player on the server
		self.otherPlayers = [];
		
		// SocketIO object used for communication with the webserver
		self.io = io({transports: ['websocket']});

		/*
		* Draws the map (grid)
		*/
		self.drawMap = function(){
			var ctx = self.context;
			ctx.strokeStyle = "#bfbfbf";
			ctx.beginPath();
			for(var i = 0 - (self.yOffset % self.gridHeight); i < self.screenHeight && self.yOffset + i < self.mapHeight; i += self.gridHeight){
				if(i < 0){
					continue;
				}
				
				ctx.moveTo(0,i);
				ctx.lineTo(self.screenWidth,i);
			}
			
			for(var i = 0 - (self.xOffset % self.gridWidth); i < self.screenWidth && self.xOffset + i < self.mapWidth; i += self.gridWidth){
				if(i < 0){
					continue;
				}
		
				ctx.moveTo(i,0);
				ctx.lineTo(i,self.screenHeight);
			}
			ctx.stroke();
			ctx.strokeStyle = "#000000";
		};
		
		self.checkPlayers = function(){
			var ctx = self.context;	
			var playerX = self.player.X;
			var playerY = self.player.Y;
			
			for(var i = 0; i < self.otherPlayers.length; ++i){
				var otherPlayer = self.otherPlayers[i];				
				var playerRadius = otherPlayer.size;
				
				if( otherPlayer.x + playerRadius > self.xOffset && otherPlayer.x - playerRadius < self.xOffset + self.screenWidth &&
					otherPlayer.y + playerRadius > self.yOffset && otherPlayer.y - playerRadius < self.yOffset + self.screenHeight){

					var distance = Math.sqrt(Math.pow(otherPlayer.y - playerY,2) + Math.pow(otherPlayer.x - playerX,2));

					if(distance <= Math.abs(playerRadius - self.player.size)){
						// "Om nom nom" -> eat other player
						otherPlayer.eat();
						--i;
						continue;
					}
					
					otherPlayer.draw();
				}
			}
			ctx.fillStyle = "black";
		};

		/*
		*	Draw scrap on screen
		*/
		self.checkScrap = function(){
			var ctx = self.context;	
			var scrapRadius = 15;
			var playerX = self.player.x;
			var playerY = self.player.y;

			for(var i = 0; i < self.scrapList.length; ++i){
				var scrapElement = self.scrapList[i];
				
				if( scrapElement.x + scrapRadius > self.xOffset && scrapElement.x - scrapRadius < self.xOffset + self.screenWidth &&
					scrapElement.y + scrapRadius > self.yOffset && scrapElement.y - scrapRadius < self.yOffset + self.screenHeight){

					var distance = Math.sqrt((scrapElement.y - playerY)*(scrapElement.y - playerY) +
									(scrapElement.x - playerX)*(scrapElement.x - playerX));

					// eat scrap
					if(distance <= Math.abs(scrapRadius - self.player.size)){
						scrapElement.eat();
						--i;
						continue;
					}
					
					scrapElement.draw();
				}
			}
		};
		
				// http://scienceprimer.com/drawing-regular-polygons-javascript-canvas
		self.drawPolygon = function(numberOfSides, size, Xcenter, Ycenter, color){		 
			var ctx = self.context;
			ctx.beginPath();
			ctx.moveTo (Xcenter +  size * Math.cos(0), Ycenter +  size *  Math.sin(0));          
			 
			for (var i = 1; i <= numberOfSides;i += 1) {
				ctx.lineTo (Xcenter + size * Math.cos(i * 2 * Math.PI / numberOfSides), Ycenter + size * Math.sin(i * 2 * Math.PI / numberOfSides));
			}
			 
			ctx.fillStyle = color;
			ctx.fill();
			ctx.fillStyle = "black";
		}
		
		
		/*
		*
		* 	Game objects
		*
		*/
		
		
		/*
		* One piece of scrap
		*/
		self.ScrapElement = function(x,y,index){
			var self = this;
			self.x = x;
			self.y = y;
			self.size = 15;
			
			// http://stackoverflow.com/questions/1484506/random-color-generator-in-javascript
			self.color = "#"+((1<<24)*Math.random()|0).toString(16);
			
			self.eat = function(){
				var index = app.scrapList.indexOf(self);
				app.scrapList.splice(index,1);
				++app.player.size;
				// TODO: Tell server scrap was eaten
			};
			self.draw = function(){
				app.drawPolygon(5, self.size, self.x - app.xOffset, self.y - app.yOffset, self.color);
			}
		};
	
		/*
		* Another player
		*/
		self.Player = function(id, x, y, size, color){
			var self = this;
			self.id = id;
			self.x = x;
			self.y = y;
			self.color = color;
			
			if(size !== undefined){
				self.size = size;
			}else{
				self.size = 30;
			}
			self.eat = function(){
				app.io.emit("NAGARIO", {type: "EAT PLAYER",id : self.id});
				app.player.size += self.size; 
				app.playerLeft(self.id);
			}
			self.left = function(){
				app.otherPlayers.splice(app.otherPlayers.indexOf(self), 1);
			}
			self.draw = function(){
				var ctx = app.context;	
				ctx.beginPath();
				ctx.fillStyle = self.color;
				ctx.arc(self.x - app.xOffset, self.y - app.yOffset, self.size, 0, 2*Math.PI);
				ctx.fill();
				ctx.stroke();
				ctx.fillStyle = color;
			};
		}
		
		/*
		*
		* 	Game functionality
		*
		*/
		
		/*
		*	Main function of the game used for computing current direction, position and arrange drawing of elements
		*/
		self.step = function(){
			var ctx = self.context;	
			ctx.fillStyle = "white";
			ctx.fillRect(0,0,self.screenWidth,self.screenHeight);
			
			var horizontalLine = self.screenHeight / 2;
			var verticalLine = self.screenWidth / 2;
			
			if(self.mouseY > horizontalLine){
				self.yOffset += Math.log(1 + self.mouseY - horizontalLine);
			}else if(self.mouseY < horizontalLine){
				self.yOffset -= Math.log(1 + horizontalLine - self.mouseY);
			}
			
			if(self.mouseX > verticalLine){
				self.xOffset += Math.log(1 + self.mouseX - verticalLine);
			}else if(self.mouseX < verticalLine){
				self.xOffset -= Math.log(1 + verticalLine - self.mouseX)
			}
			
			if(self.xOffset < 0){
				self.xOffset = 0;
			}else if(self.xOffset + self.screenWidth > self.mapWidth){
				self.xOffset = self.mapWidth - self.screenWidth;
			}
			
			if(self.yOffset < 0){
				self.yOffset = 0;
			}else if(self.yOffset + self.screenHeight > self.mapHeight){
				self.yOffset = self.mapHeight - self.screenHeight;
			}
			
			self.player.x = (self.screenWidth / 2) + self.xOffset;
			self.player.y = (self.screenHeight / 2) + self.yOffset;
					
			self.drawMap();
			self.checkScrap();
			self.checkPlayers();
			self.player.draw();
		};
		
		/*
		* Retrieves a player object given it's id.
		*/
		self.getPlayer = function(playerId){
			// http://stackoverflow.com/questions/13964155/get-javascript-object-from-array-of-objects-by-value-or-property
			var possiblePlayers = self.otherPlayers.filter(function(obj){ return obj.id == playerId});
			
			if(possiblePlayers.length > 0){
				return possiblePlayers[0];
			}else{
				return null;
			}
		}
		
		/*
		* Player joined the game -> Add it to the list of players
		*/
		self.playerJoined = function(playerId, x, y, size, color){
			self.otherPlayers.push(new self.Player(playerId,x,y, size, color));
		}
		
		/*
		* We got an update of another players location/size
		*/
		self.updatePlayer = function(playerId, x, y, size){
			var p = self.getPlayer(playerId);
			
			if(p != null){
				p.x = x;
				p.y = y;
				p.size = size;
			}
		}
		
		/*
		* Handles a message we got from the game server
		*/
		self.handleMessage = function(m){
			switch(m.type){
				case "LEFT":
					self.getPlayer(m.playerId).left();
					break;
				case "UPDATE":
					self.updatePlayer(m.playerId, m.x, m.y, m.size);
					break;
				case "WELCOME":
					self.xOffset = m.x;
					self.yOffset = m.y;
					self.player.playerId = m.playerId;
					self.player.size = m.size;
					self.player.color = m.color;
					break;
				case "PLAYER JOINED":
					self.playerJoined(m.playerId,m.playerX,m.playerY,m.size,m.color);
					break;
				case "DEAD":
					alert("You got killed by: " + m.id);
					clearInterval(self.updateInterval);
					clearInterval(self.stepInterval);
					break;
				default:
			}
		};
		
		/*
		*	Sends update of our player to the game server
		*/
		self.sendUpdate = function(){
			var message = $.extend({}, self.player);
			message.type = "UPDATE";
			self.io.emit("NAGARIO", message);
		}
		
		self.configureCanvas = function(){
			var canvas = document.getElementById("screen");
			canvas.width = document.body.clientWidth;
			canvas.height = document.body.clientHeight;
			self.screenWidth = canvas.width;
			self.screenHeight = canvas.height;
		};

		/*
		*	Stuff that needs to be done when the document is ready
		*/
        $(document).ready(function () {			
			var canvas = document.getElementById("screen");
			if( canvas.getContext )
			{
				self.context = canvas.getContext("2d");
			}
			
			/* Configure canvas once */
			self.configureCanvas();
			
			/* Reconfigure canvas if window size has changed */
			$(window).on("resize", self.configureCanvas);
			
			/* Log current position of the mouse */
			document.onmousemove = function(e){
				self.mouseX = e.pageX;
				self.mouseY = e.pageY;
			};
			
			/* Create Scrap elements and placec them on the map */
			var horizontalLine = self.screenHeight / 2;
			var verticalLine = self.screenWidth / 2;
			self.scrapList = new Array(10000);
			
			for(var i = 0; i < self.scrapList.length; ++i){
				var x = Math.random() * (self.mapWidth - 2*verticalLine) + verticalLine;
				var y = Math.random() * (self.mapHeight - 2*horizontalLine) + horizontalLine;
				self.scrapList[i] = new self.ScrapElement(x, y, i);
			}
			
			self.player = new self.Player(-1,-1,-1,-1);
			
			/* Establish connection to game server */
			self.io.on('NAGARIO', self.handleMessage);
			self.updateInterval = setInterval(self.sendUpdate,100);	
			
			/* Start the game */
			self.stepInterval = setInterval(self.step,40);
        });