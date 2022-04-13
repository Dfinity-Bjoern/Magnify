# Magnify Video Conferencing

Magnify is an open video conferencing application that illustrates how to create a basic multi-user video conferencing service that runs on the Internet Computer.

## Before you begin

Before you build, deploy, and run the Magnify application, verify the following:

* You have an internet connection and access to a shell terminal on your local macOS or Linux computer.

* You have `+node.js+` installed if you want to include the files for front-end development in your project.

* You have the supported version of the DFINITY Canister SDK installed locally on your computer.

    To download and install the supported version of the DFINITY Canister SDK, run the following command:

    ```bash
    DFX_VERSION=0.8.4 sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"
    ```

## Clone the Magnify repository

To experiment with the Magnify sample application:

1. Open a terminal shell and change to the folder you are using for your Internet Computer sample projects.

1. Clone the `Magnify` repository.

    ```bash
    git clone https://github.com/Dfinity-Bjoern/Magnify
    ```

1. Change to the local working directory for the `Magnify` repository.

    ```bash
    cd Magnify
    ```

1. Install node modules by running the following command:

    ```bash
    npm install
    ```

    If necessary, run `npm audit fix` to fix any issues before continuing.

## Start the local network

Before you can build the Magnify application, you need to connect to the Internet Computer network.

To connect to the network running locally:

1. Open a new terminal window or tab on your local computer and navigate to the Magnify directory.

    You should have two terminals open with your project directory as your current working directory.

1. In the first terminal, start the Internet Computer locally by running the following command:

    ```bash
    dfx start 
    ```
1. Leave the terminal that displays network operations open and switch your focus to the second terminal.

## Build and deploy the program

To build and deploy Magnify:

1. In the second terminal, build the executable by running the following command:

    ```bash
    dfx build
    ```
1. Deploy Msgnify on the local network by running the following command:

    ```bash
    dfx canister install --all
    ```

    You should see output similar to the following:

    ```bash
    Installing code for canister magnify, with canister_id ic:05000000000000000000000000000000000185
    Installing code for canister magnify_assets, with canister_id ic:060000000000000000000000000000000001FB
    ```

1. Copy the canister identifier for the `+magnify_assets+` canister to the clipboard or a notepad application.

## Open Magnify in a browser

To open Magnify in a browser:

1. Open a browser tab and navigate to the default host name and port, localhost:8000 or 127.0.0.1:8000.

1. Add `+/?canisterId=+` and paste the canister identifier for `+magnify_assets+` to complete the URL.

    For example, the full URL should look similar to the following:

    ```bash
    http://localhost:8000/?canisterId=ic:060000000000000000000000000000000001FB
    ```

1. Create a room and invite others to join you in the conference.

## Basic code structure

There are really only four files that an application developer would touch:

1. Backend:  

    a. The backend logic is in the Motoko-language file of the Canister `src/magnify/main.mo`  

    b. There is a Motoko file with utility functions `src/magnify/Utils.mo` used by `src/magnify/main.mo`  

2. Frontend:   

    a. The frontend (UX) is in the JavaScript file `src/manify_assets/public/index.js`  

    b. The Styling of the UX is in the CSS file `src/manify_assets/public/styles.css`  


## Background information

Magnify is based on two key technologies:

- [WebRTC](https://webrtc.org/)
- [DFINITY Internet Computer](https://sdk.dfinity.org/developers-guide/quickstart.html)

## Created by

Magnify was created by a multi-national group of rebels called "Team Phantomias." 

