#!/usr/bin/env node
// Copyright (c)2022 Quinn Michaels
const Deva = require('@indra.ai/deva');
const path = require('path');
const fs = require('fs');

const {client,agent,vars} = require(path.join(__dirname, 'data.json')).data;
const lib = require('./lib');

const feecting = require('@indra.ai/feectingdeva');

// Creates a new DEVA Buddy.
const RIGVEDA = new Deva({
  agent: {
    key: agent.key,
    name: agent.name,
    prompt: agent.prompt,
    voice: agent.voice,
    profile: agent.profile,
    translate(input) {
      return input.trim();
    },
    parse: require('./_parse'),
  },
  lib,
  vars,
  client,
  devas: {
    feecting,
  },
  listeners: {},
  modules: {},
  func: {
    /***********
      func: books
      params: packet
      describe: The books function builds teh books files from the json data.
    ***********/
    books(packet) {
      return new Promise((resolve, reject) => {
        if (!packet) return reject('NO PACKET');
        const {title, describe, data} = require(path.join(this.vars.paths.sync, 'json/index.json'));
        if (!data) return reject(`${this.vars.messages.error} NO BOOK`);
        const _text = [
          `## ${title}`,
          `p: ${describe}`,
        ];
        // loop over the data and format it into a feecting command string
        data.forEach(book => {
          _text.push(`cmd[${book.title}]:#${this.agent.key} book ${book.key}`);
        });
        this.question(`#feecting parse:${this.agent.key} ${_text.join('\n')}`).then(feecting => {
          return resolve({
            text:feecting.a.text,
            html:feecting.a.html,
            data,
          });
        }).catch(reject);
      })
    },

    /***********
      func: book
      params: packet
      describe: The book function builds teh book files from the json data.
    ***********/
    book(packet) {
      return new Promise((resolve, reject) => {
        if (!packet) return reject('NO PACKET');
        const book = packet.q.text.length < 2 ? `0${packet.q.text}` : packet.q.text;
        const {title, describe, data} = require(path.join(this.vars.paths.archive, `${book}.json`));
        const _text = [
          `## ${title}`,
          `p: ${describe}`,
        ]
        data.forEach(hymn => {
          _text.push(`cmd[${hymn.title}]:#${this.agent.key} view ${hymn.key}`)
        });
        this.question(`#feecting parse:${this.agent.key} ${_text.join('\n')}`).then(feecting => {
          return resolve({
            text:feecting.a.text,
            html:feecting.a.html,
            data,
          });
        });
      });
    },

    /**************
    func: view
    params: packet
    describe: The View function returns a specific hymn from one of the Books.
    ***************/
    hymn(h) {

      return new Promise((resolve, reject) => {
        if (!h) return reject('NO HYMN');
        const hymnPath = path.join(__dirname, '..', 'json', 'hymns', `${h}.json`);

        const hymnExists = fs.existsSync(hymnPath);

        if (!hymnExists) return resolve(this.vars.messages.notfound);

        const hymn = require(hymnPath);

        const text = [
          `## ${hymn.data.title}`,
          hymn.data.feecting,
          `::begin:buttons`,
          hymn.data.previous ? `cmd[Previous]:#${this.agent.key} view ${hymn.data.previous}` : '',
          hymn.data.next ? `cmd[Next]:#${this.agent.key} view ${hymn.data.next}` : '',
          `cmd[Book]:#${this.agent.key} book ${hymn.data.meta.book}`,
          `cmd[Original]:#web get ${hymn.data.meta.original}`,
          `cmd[Sanskrit]:#web get ${hymn.data.meta.sanskrit}`,
          `::end:buttons`,
        ].join('\n');

        this.question(`#feecting parse:${this.agent.key} ${text}`).then(feecting => {
          return resolve({
            text:feecting.a.text,
            html:feecting.a.html,
            data:hymn.data,
          });
        }).catch(reject);

      });
    },

    /***********
      func: buildIndex
      params: opts (file, parsed)
      describe: the function synchronizes the veda the user is pulling from the
      public source and will then create an html file for the local sync
    ***********/
    buildIndex() {
      const {template, buildBooks} = this.func;
      // get the json data file for the index.
      const books = require(path.join(this.vars.paths.archive), 'index.json');

      // build index html
      return new Promise((resolve, reject) => {
        // map the books into a link array
        const _books = books.data.map(book => {
          return `href[${book.title}]:${book.link}`;
        });
        _books.unshift('::begin:books'); // insert box at beginning of array.
        _books.push('::end:books'); // insert box end at end of array.

        // then we are going to send it to the feecting deva to parse this stuff.
        this.question(`#feecting parse:${this.agent.key} ${_books.join('\n')}`).then(feecting => {

          const _html = this.func.template({
            key: '0x00',
            title: books.title,
            info: true,
            describe: books.describe,
            html: feecting.a.html,
          });

          const file_path = path.join(this.vars.paths.sync, books.link)
          try {
            fs.writeFileSync(file_path, _html);
            this.prompt(`${this.vars.messages.buildindex} ${file_path}`)
          } catch (e) {
            return reject(e);
          } finally {
            return resolve({
              msg: this.vars.messages.buildindexdone,
              data: books,
            });
          }

        }).catch(err => {
          return this.error(err, false, reject);
        });
      });
    },

    /**************
    func: buildBooks
    params: books - which books to build from the build function
    describe: This function takes the books from the build function and then builds
    a list of books for the json data api. From here it will take the list and also
    produced a feecting parsed html file with the json file for storage.
    ***************/
    buildBooks(books) {
      // get the json data file for the index.
      const {buildHymns,template} = this.func;
      const ret_hymns = [];

      return new Promise((resolve, reject) => {
        books.data.forEach(book => {
          const _book = require(path.join(this.vars.paths.sync, book.api));
          let writejson = false;

          // let's clean the title
          _book.data.forEach((hymn,idx) => {
            ret_hymns.push(hymn);
            const _parsed = this.agent.parse(this.lib.decode(hymn.title), false);
            // if the titles are different update the json record index.
            if (hymn.title != _parsed) {
              _book.data[idx].title = _parsed;
              _book.data[idx].updated = Date.now();
              writejson = true;
            }
          });

          // map the hymns data into an array that can be formatted with feecting.
          const _hymns = _book.data.map((hymn, idx) => {
            return `href[${idx+1}:${this.agent.parse(hymn.title, false)}]:${hymn.link}`;
          });
          _hymns.unshift('::begin:book');
          _hymns.push('::end:book');

          // question the feecting deva to get formatted data to write the files.
          this.question(`#feecting parse:${this.agent.key} ${_hymns.join('\n')}`).then(feecting => {
            const _html = template({
              key: `0x${_book.key}`,
              title: this.agent.parse(_book.title, false),
              info: true,
              describe: _book.describe,
              html: feecting.a.html,
            });

            // write the book html file to the main direcotry.
            const _bookFile = path.join(this.vars.paths.sync, book.link);
            fs.writeFileSync(_bookFile, _html);
            this.prompt(`${this.vars.messages.buildbooks} ${_bookFile}`);

            // update the book json file with the latest information.
            const _jsonFile = path.join(this.vars.paths.sync, book.api);
            fs.writeFileSync(_jsonFile, JSON.stringify(_book, null, 2));
            this.prompt(`${this.vars.messages.buildbooks} ${_jsonFile}`);

          }).catch(err => {
            return this.error(err, _book, reject)
          });
        });
        return resolve({
          msg: this.vars.messages.buildbooksdone,
          data: ret_hymns
        });
      });
    },

    /**************
    func: builHymns
    params: hymns - list of hymns to buil from.
    describe: This function buil the hymns from the buldBooks function data.
    ***************/
    buildHymns(hymns) {
      const {template,buildDeities} = this.func;
      return new Promise((resolve, reject) => {
        hymns.forEach(hymn => {
          const _hymn = require(path.join(this.vars.paths.sync, hymn.api));

          // set the data of the hymn to be the parsed data
          const parsed = this.agent.parse(this.lib.decode(_hymn.orig));
          // set the updated timestamp.
          _hymn.updated = Date.now();

          const _text = [
            `::begin:hymn`,
            _hymn.data.feecting,
            `::end:hymn`,
            `::begin:nav`,
            `href[📚]:index.html`,
            _hymn.data.meta.book ? `href[📖]:${_hymn.data.meta.book}.html` : '',
            _hymn.data.meta.previous ? `href[👈]:hymns/${_hymn.data.meta.previous}.html` : '',
            _hymn.data.meta.next ? `href[👉]:hymns/${_hymn.data.meta.next}.html` : '',
            `::end:nav`,
            `::begin:links`,
            `href[Original]:${_hymn.data.meta.orig}`,
            `href[Sanskrit]:${_hymn.data.meta.sanskrit}`,
            `::end:links`,
          ].join('\n');

          this.question(`#feecting parse:${this.agent.key} ${_text}`).then(feecting => {
            const _html = template({
              key: `0x${_hymn.key}`,
              title: _hymn.data.title,
              info: false,
              describe: _hymn.data.describe,
              link: _hymn.link,
              html: feecting.a.html
            });

            try {
              // build the deities from the parsed hymn
              buildDeities(_hymn.data.deities);

              // write the html file for the hymn
              const _htmlfile = path.join(this.vars.paths.sync, _hymn.link);
              fs.writeFileSync(_htmlfile, _html);
              this.prompt(`${this.vars.messages.buildhymns} ${_htmlfile}`)
              // update the json file with the latest data that was parsed from original.
              const _jsonfile = path.join(this.vars.paths.sync, _hymn.api);
              fs.writeFileSync(_jsonfile, JSON.stringify(_hymn, null, 2));
              this.prompt(`${this.vars.messages.buildhymns} ${_jsonfile}`)
            } catch (e) {
              return reject(e);
            }
          })
        });
        return resolve({
          msg: this.vars.messages.buildhymnsdone
        })
      });
    },

    /**************
    method: deities
    params: packet
    describe: build a list of deities to pass back to the processor.
    ***************/
    buildDeities(deities) {
      // loop over the deities returnd to add them to the global array.
      deities.forEach(deity => {
        // find deity index in global array
        const findin = this.vars.deities.findIndex(_d => _d.name.toLowerCase() == deity.name.toLowerCase());
        // if no index found push a new element.
        if (findin === -1) {
          this.vars.deities.push(deity);
        }
        // else the index is found and we update the item.
        else {
          deity.hymns.forEach(hymn => {
            this.vars.deities[findin].hymns.push(hymn);
          });
        }
      });
    },

    /**************
    method: template
    params: packet
    describe: the template function that creates the base html files for the content.
    ***************/
    template(data) {
      return [
        `<!DOCTYPE html>`,
        `<html lang="en">`,
        `<head>`,
        `<base href="/rigveda/">`,
        `<meta charset="utf-8">`,
        `<meta name="format-detection" content="telephone=no">`,
        `<meta name="msapplication-tap-highlight" content="no">`,
        `<meta name="viewport" content="user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1, width=device-width">`,
        `<meta name="apple-mobile-web-app-capable" content="yes" />`,
        `<meta name="apple-mobile-web-app-status-bar-style" content="black">`,
        `<link rel="shortcut icon" type="image/png" href="https://deva.space/cdn/favicon.png"/>`,
        `<title>indra.ai - #rigveda ${data.title}</title>`,
        `<meta property="description" content="${data.describe}">`,
        `<meta name="robots" content="index, follow" />`,
        `<meta property="og:title" content="indra.ai - ${data.title}">`,
        `<meta property="og:description" content="${data.describe}">`,
        `<meta property="og:url" content="http://indra.ai/rigveda/${data.link}">`,
        `<meta property="og:image" content="http://indra.ai/rigveda/img/splash.png">`,
        `<meta name="twitter:card" content="summary_large_image">`,
        // `<!-- Google tag (gtag.js) -->`,
        // `<script async src="https://www.googletagmanager.com/gtag/js?id=UA-126646842-1"></script>`
        // `<script>window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'UA-126646842-1');</script>`,
        `<link rel="stylesheet" href="css/main.css">`,
        `<link rel="stylesheet" href="https://use.typekit.net/quz8tpe.css">`,
        `<script type="text/javascript" async src="https://platform.twitter.com/widgets.js"></script>`,
        `</head>`,
        `<body>`,
        `<header>`,
        `<a href="index.html"><img src="img/title.png" alt="indra.ai is the place to learn the #rigveda." /></a>`,
        `<h2>${data.title}</h2>`,
        `</header>`,
        `<section class="info">`,
        data.info ? `<p>${data.describe}</p>` : '',
        `</section>`,
        `<main>`,
        data.html,
        `</main>`,
        `<section id="Share" class="share">`,
        `<div class="twitter">`,
        `<a class="twitter-share-button" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(data.describe)}&via=indradotai&hashtags=${data.key},Vamraka,Indu,Indra,Soma,Agni,Yama,RigVeda" data-size="large">Tweet</a>`,
        `<a class="twitter-follow-button" href="https://twitter.com/indradotai" data-size="large">Follow @indradotai</a>`,
        `</div>`,
        `</section>`,
        `<footer><a href="https://indra.ai/rigveda">#rigveda</a> is providedy by <a href="https://indra.ai">indra.ai</a><br>&copy;Copyright 2022 Quinn Michaels. All Rights Reserved.</footer>`,
        `</body>`,
        `</html>`,
      ].join('\n');
    },

    /**************
    func: devas
    params: packet
    describe: Build a list of devas currently loaded into the system.
    ***************/
    devas(packet) {
      return new Promise((resolve, reject) => {
        const devas = [];
        try {
          for (let deva in this.devas) {
            devas.push(`cmd:#${deva} help`);
          }
        } catch (e) {
          return this.error(e, packet, reject);
        } finally {
          this.question(`#feecting parse ${devas.join('\n')}`).then(parsed => {
            return resolve({
              text:parsed.a.text,
              html:parsed.a.html,
              data:parsed.a.data,
            })
          }).catch(err => {
            return this.error(err, packet, reject);
          })
        }
      });
    },
  },

  methods: {
    /**************
    method: build
    params: packet
    describe: Call the build function to generate the html files.
    ***************/
    build(packet) {
      return new Promise((resolve, reject) => {
        this.func.buildIndex(packet).then(build => {
          this.prompt(build.msg);
          return this.func.buildBooks(build.data);
        }).then(books => {
          this.prompt(books.msg);
          return this.func.buildHymns(books.data);
        }).then(hymns => {
          this.prompt(hymns.msg);
          return resolve({
            text:this.vars.messages.done,
            html:this.vars.messages.done,
          });
        }).catch(err => {
          return this.error(err, packet, reject);
        })
      });
    },

    /**************
    method: books
    params: packet
    describe: Call the books function to see the books list
    ***************/
    books(packet) {
      return this.func.books(packet);
    },

    /**************
    method: hymn
    params: packet
    describe: Call the view function to read a specific book
    ***************/
    book(packet) {
      return this.func.book(packet);
    },

    /**************
    method: hymn
    params: packet
    describe: Call the view function to read a specific book
    ***************/
    hymn(packet) {
      return this.func.hymn(packet.q.text);
    },

    /**************
    method: uid
    params: packet
    describe: Return system uid for the based deva.
    ***************/
    uid(packet) {
      const uid = this.uid();
      return Promise.resolve({text:uid,html:uid});
    },

    /**************
    method: status
    params: packet
    describe: Return the current status for the system deva.
    ***************/
    status(packet) {
      return this.status();
    },

    /**************
    method: devas
    params: packet
    describe: Call devas function and return list of system devas.
    ***************/
    devas(packet) {
      return this.func.devas(packet);
    },
  },

  /**************
  func: onEnter
  params: none
  describe: The custom onEnter state handler to initialize the Devas correctly.
  ***************/
  onEnter() {
    this.prompt('entering the rigveda')
    return this.initDevas().then(devasInit => {
      this.prompt(devasInit);
      return this.done(this.vars.messages.enter);
    });
  },

  onError(err) {
    console.log('###############');
    console.log('###############');
    console.log('###############');
    console.log('###############');
    console.log(err);
  },
});


module.exports = RIGVEDA;
