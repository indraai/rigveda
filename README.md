# rigveda

The #rigveda repository holds a customized verion of the Rig Veda that we use in the Indra Quantum Computing Environment to teach the Clients and Agents.

The repository comples equipped with a command line too to build the files and a local webserver to make sure your builds are clean before publishing.

To install the development tools.

```shell
$ npm i
```

To start the server after the components install.

```shell
$ npm start
```

Once the application is running there are a couple utility methods you can use to build the application.

1. The build command builds the #rigveda system.

`!build`

2. The books command will return a listing of books.
`!books`

3. The hymn command will return the specificed hymn number.

`!hymn *hymn#*`

4. The uid command will return a unique id.

`!uid`

5. The status command will return the status of the deva and the time it went online.

`!status`

6. The devas command will return a list of currently loaded devas. By default only the #feecting deva is loaded into the builder.

`!devas`
