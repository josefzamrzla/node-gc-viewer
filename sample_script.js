function MyClass (v) {
	this.v = v;
}

MyClass.prototype.get = function () {
	return this.v;
};

var arr = [];

setInterval(function () {
	var inst1 = new MyClass((new Array(1000)).join('foo'));
	var inst2 = new MyClass((new Array(1024 * 1024)).join('foo'));

	arr.push(inst1);
}, 500);

var toM = function (v) {
	return Math.round((v / 1024 / 1024) * 100) / 100;
};

setInterval(function () {
	var mem = process.memoryUsage();
	console.log('heap', toM(mem['heapUsed']), 'rss', toM(mem['rss']));
}, 1000);

