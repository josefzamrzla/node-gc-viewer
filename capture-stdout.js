var fs = require('fs'), path = require('path');
var stdout = fs.createWriteStream(path.join(process.cwd(), '.captured.stdout'));
process.stdout.write = stdout.write.bind(stdout);
