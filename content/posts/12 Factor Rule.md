---
title: "12 Factor Rule"
date: 2026-09-19
tags: [BadReads]
description: "Contract Between the backend systems and the cloud server or platform running the backend - provided by engineers at Heruko"
---

It is the metholodogy for building software as a service apps.

Deployment of an app in earlier days.

1. Engineers need to rent a server or they had a physical machine. They had to install os, language runtime, database, libraries manually. Set the configuration, using SSH. Every engineered output was snowflake, unique and hand-shaped : meaning diffcult to replicate or even fix when documentation was available. This lead to software erosion, meaning this type of app would eventually fail.


So, 12 Factor Rule solves this software erosion.

1. Codebase
Each app maps to a single repository (such as Git, Mercurial, or Subversion). If multiple apps share code, they must refactor that code into distinct shared libraries rather than combining codebases

2. Dependencies = goal is to maintain a manifest file like go mod or lock file that clearly defines the version of each libraries so there is no guessing and hit and trial of finding versions.

 However, you might declare the version but not app may run the version installed on the system, so there is problem of isolation.Different systems install different versions. This was solved by docker as image contains, code,system tools,os and libraries all, each one of them frozen by docker.

 3. Config = different based on different  deploys. With deploys it means, local machine, stagging, production.
 Database running in each deploys have different URL. So, harcoding it creates the problem. So, reading it from the environment solves the problem. 

 It should be kept outside of the code. Environment Variables are part of the os, runs on every language. Env variables are easy to change between deployments. No accidental leak.

 This ensures the code remains same throughout the deploys but config gets changed

Env var are not good for secrets. So, secrets can be managed using secret manager like vault.During starting phase of application, it is fetched and stored in the memory.

4. Backing Services
 The services running locally in a machine along with the service running in another machine should be treated equally. 
 The code should be same if i want to change service from local service to remote service. For example, if i am using url of local postresql for database service, changing it to remote service should be efficently handled just by changing resource handle. Each lines of codes should remains same, only resource handle(url + credentials). 

 5. Build,Release and Run 

Build is converting the source code into the binary(runnable artifact)

Release is build + config

Run means something that runs the artifact. 

6. Processes
The app should run as one or more stateless process which enables scalability. The persistent user data in an external backing service.

7. Port Binding 
A particular application  should run as self contained service rather than running inside a server like(PHP app in apache server ). The services of an app should be exported via port binding.

8. Concurrency
Process are the first class citizens. While scaling out horizontally, scalaing should be done in process level rather than thread or bigger individual servers.

9. Disposability
Every process should be easier to dispose. There should be proper startup and shutdown.

10. Logs
Logs should be streamed as standard output. Any platform can be used to access those logs and organize them as needed.

11. Admin Processes
The one-off proccess like migrate.db should be deployed along with full time process in the same environment rather than doing ssh from different machine.



