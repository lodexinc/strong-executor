#!/usr/bin/env node
// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-executor
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

'use strict';

// Exit on loss of parent process, if it had established an ipc control channel.
// We do this ASAP because we don't want child processes to leak, outliving
// their parent. If the parent has not established an 'ipc' channel to us, this
// will be a no-op, the disconnect event will never occur.
process.on('disconnect', function() {
  process.exit(2);
});

var Parser = require('posix-getopt').BasicParser;
var defaults = require('strong-url-defaults');
var mkdirp = require('mkdirp').sync;
var path = require('path');
var fs = require('fs');

var Executor = require('../');

function printHelp($0, prn) {
  var USAGE = fs.readFileSync(require.resolve('./sl-executor.txt'), 'utf-8')
    .replace(/%MAIN%/g, $0)
    .trim();

  prn(USAGE);
}

var $0 = process.env.CMD ? process.env.CMD : path.basename(process.argv[1]);
var parser = new Parser([
  ':v(version)',
  'h(help)',
  'b:(base)',
  'd:(driver)',
  'C:(control)',
  'P:(base-port)',
  'A:(svc-addr)',
].join(''), process.argv);

var base = '.strong-executor';
var control;
var driver = 'direct';
var basePort = 3000;
var svcAddr = null;

var option;
while ((option = parser.getopt()) !== undefined) {
  switch (option.option) {
    case 'v':
      console.log(require('../package.json').version);
      process.exit(0);
      break;
    case 'h':
      printHelp($0, console.log);
      process.exit(0);
      break;
    case 'b':
      base = option.optarg;
      break;
    case 'd':
      driver = option.optarg;
      break;
    case 'C':
      control = option.optarg;
      break;
    case 'P':
      basePort = Number(option.optarg) || basePort;
      break;
    case 'A':
      svcAddr = option.optarg;
      break;
    default:
      console.error('Invalid usage (near option \'%s\'), try `%s --help`.',
                    option.optopt, $0);
      process.exit(1);
      break;
  }
}

base = path.resolve(base);

if (parser.optind() !== process.argv.length) {
  console.error('Invalid usage (extra arguments), try `%s --help`.', $0);
  process.exit(1);
}

// Run from base directory, so files and paths are created in it.
mkdirp(base);
process.chdir(base);

if (!control) {
  console.error('Control endpoint missing, try `%s --help`.', $0);
  process.exit(1);
}

control = defaults(control, {
  host: '127.0.0.1',
  port: 8701,
});


var exec = new Executor({
  basePort: basePort,
  cmdName: $0,
  control: control,
  driver: driver,
  svcAddr: svcAddr,
});

try {
  exec.start(function() {
    console.log('%s: connected to %s', $0, control);
  });
} catch (err) {
  console.error('%s: connect to %s failed: %s', $0, control, err.message);
  process.exit(1);
}

exec.on('disconnect', function(err) {
  console.error('%s: connect to %s failed with %s', $0, control, err.message);
  process.exit(1);
});
