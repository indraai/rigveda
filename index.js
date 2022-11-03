#!/usr/bin/env node
"use stsrict"

// Copyright (c) 2022 Quinn Michaels
// The #rigveda builder


// Copyright (c)2022 Quinn Michaels
// Distributed under the MIT software license, see the accompanying
// file LICENSE or http://www.opensource.org/licenses/mit-license.php.

// the deva cli
const path = require('path');
const fast = require('fastify')({
  logger:false,
});
const fastStatic = require('@fastify/static');

const port = 8081;

const {version} = require('./package.json');
const rigveda = require('./src');

const readline = require('readline');
const shell = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(`#rigveda builder > ${version}`)


// create the shell promp with proper chalk colors from the passed in options.
function shellPrompt(opts) {
  const {prompt, text} = opts;
  const {colors} = prompt; // set agent prompt colors

  shell.setPrompt(`${prompt.emoji} ${prompt.text.trim()}: `);
  shell.prompt();
  if (text) console.log(text);
  shell.prompt();
}

// set the listen for the prompt event and then output here.
rigveda.listen('prompt', prompt => {
  shellPrompt(prompt); // set the prompt from passed data
})

rigveda.listen('clearshell', () => {
  console.log('\n');
});

rigveda.init();

shell.on('line', question => {
  // the event that fires when a new command is sent through the shell.
  if (question === '!exit') return shell.close();

  // ask a question to the deva ui and wait for an answer.
  rigveda.question(question).then(answer => {
    // sen the necessary returned values to the shell prompt.
    shellPrompt({
      prompt: answer.a.agent.prompt,
      text: answer.a.text,
    });
    // set the shell prompt back to the main agent prompt
    shellPrompt({prompt:rigveda.client.prompt})
  }).catch(e => {
    console.error(e);
  });

}).on('pause', () => {

}).on('resume', () => {

}).on('close', () => {
  // begin close procedure to clear the system and close other devas properly.
  shell.setPrompt('');
  shell.prompt();

  rigveda.stop().then(_exit => {
    shellPrompt({
      prompt: rigveda.client.prompt,
      text: _exit.msg,
    });
    process.exit(0);
  }).catch(console.error);

}).on('SIGCONT', () => {
}).on('SIGINT', data => {
  shell.close();
}).on('SIGSTOP', () => {});


// create the static routes for the local server.
// public is used to deliver local assets
const staticRoutes = [
  {
    root: path.join(__dirname),
    prefix: '/rigveda',
    prefixAvoidTrailingSlash: true,
  },
]

// register static routes with the fast server.
staticRoutes.forEach(rt => {
  fast.register(fastStatic, rt);
})

// launch fast server to listen to the port rom the vars scope
fast.listen({port}).then(() => {
  rigveda.prompt(`WEB SERVER ${port}`);
}).catch(console.error);
