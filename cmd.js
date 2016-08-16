#!/usr/bin/env node
"use strict";
const opn = require('opn');
const spawn = require('child_process').spawn;
const GcLogParser = require('gc-log-parser');
var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var parser = new GcLogParser();
var buffer = [];

parser.on('stats', function (stats) {
	if (io.sockets.adapter.rooms['all'] && io.sockets.adapter.rooms['all'].length > 0) {
		io.in('all').emit('stats', stats);
	} else {
		console.log('no clients, buffering');
		buffer.push({event: 'stats', data: stats});
	}
});

var args = ['--trace_gc', '--trace_gc_verbose', '--trace_gc_nvp'];
var cmdArgs = process.argv.slice(2);
if (!cmdArgs.length) {
	var version = require('./package.json').version;
	process.stdout.write('node-gc-viewer ' + version + '\n');
	return require('fs').createReadStream(__dirname + '/usage.txt').pipe(process.stdout);
} else {
	console.log('Initializing');
	for (var i = 0; i < cmdArgs.length; i++) {
		if (args.indexOf(cmdArgs[i]) === -1) {
			args.push(cmdArgs[i]);
		}
	}

	var gc = spawn('node', args);
	gc.stderr.on('data', function (e) {
		console.error('Spawn error', e.toString());
		buffer.push({event: 'spawn_error', data: e.toString()});
	});

	const readline = require('readline');
	const rl = readline.createInterface({
		input: gc.stdout
	});

	const showGcLog = process.env.SHOW_GC_LOG || false;
	rl.on('line', function (line) {
		if (parser.parse(line)) {
			if (showGcLog) {
				console.log(line);
			}
		} else {
			console.log(line);
		}
	});
}

var port = process.env.PORT || 9999,
	domain = process.env.DOMAIN || 'localhost';

io.on('connection', function(socket) {
	socket.join('all');
});

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.get('/', function (req, res) {
	res.render('index', { domain: domain, port: port })
});

app.get('/favicon.ico', function (req, res) {
	res.writeHead(200, {'Content-Type': 'image/x-icon'} );
	res.end();
});

setTimeout(function () {
	server.listen(port, function () {
		console.log('Starting backend on port ', port);
		opn('http://' + domain + ':' + port);
		console.log('Navigate your browser to http://' + domain + ':' + port + ' if it does not start automatically');
	});
}, 1000);

setInterval(function () {
	if (io.sockets.adapter.rooms['all'] && io.sockets.adapter.rooms['all'].length > 0) {
		while (buffer.length > 0) {
			var item = buffer.shift();
			io.in('all').emit(item.event, item.data);
		}
	}
}, 1000);

module.exports = {};