#!/usr/bin/env node
"use strict";
var open = require('open');
var spawn = require('child_process').spawn;
var GcLogParser = require('gc-log-parser');
var Tail = require('tail').Tail;
var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs'), path = require('path');
var gcOutPath = path.join(process.cwd(), '.captured.gcout');
var stdOutPath = path.join(process.cwd(), '.captured.stdout');

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
	return fs.createReadStream(path.join(__dirname, 'usage.txt')).pipe(process.stdout);
} else {
	try {
		fs.writeFileSync(gcOutPath, '');
	} catch (e) {
		console.log('Cannot create temp file to capture gc output (' + gcOutPath + ')');
		process.exit();
	}

	var gcOut = fs.openSync(gcOutPath, 'w');
	var gcOutWatcher = new Tail(gcOutPath);

	console.log('Initializing');
	if ((parseInt(process.versions.node, 10) || 0) === 0) {
		console.log('\nWARNING: you are using Node.js version < 2.0, GC output can be corrupted by standard output\n');
	} else {
		try {
			fs.writeFileSync(stdOutPath, '');
		} catch (e) {
			console.log('Cannot create temp file to capture script output (' + stdOutPath + ')');
			process.exit();
		}

		var childOut = new Tail(stdOutPath);
		childOut.on('line', function(line) {
			console.log(line);
		});

		args.unshift('-r', path.join(__dirname, 'capture-stdout'));
	}

	for (var i = 0; i < cmdArgs.length; i++) {
		if (args.indexOf(cmdArgs[i]) === -1) {
			args.push(cmdArgs[i]);
		}
	}

	var child = spawn('node', args, {stdio: ['pipe', gcOut, 'pipe']});
	child.stderr.on('data', function (e) {
		console.error('Spawn error', e.toString());
		buffer.push({event: 'spawn_error', data: e.toString()});
	});
	child.on('exit', function (code) {
		console.error('Child process has died with code:', code);
		buffer.push({event: 'spawn_error', data: 'Child process has died with code: ' + code});
	});

	var showGcLog = process.env.SHOW_GC_LOG || false;
	gcOutWatcher.on('line', function(line) {
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
		open('http://' + domain + ':' + port);
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