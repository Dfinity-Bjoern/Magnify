# MAGNIFY

Magnify is an open video conference app hosted by an Internet Computer canister. 

## How to run

### In Terminal window 1
```bash
cd magnify/

npm install

dfx start


```

### In Terminal window 2

```bash
cd magnify/

npm install

dfx build && dfx canister install --all --mode=reinstall

```


## Basic Code Structure

There are really only four files that an application developer would touch:

1. Backend:  

    a. The backend logic is in the Motoko-language file of the Canister `src/magnify/main.mo`  

    b. There is a Motoko file with utility functions `src/magnify/main.mo` used by `src/magnify/main.mo`  

2. Frontend:   

    a. The frontend (UX) is in the JavaScript file `src/manify_assets/public/index.js`  

    b. The Styling of the UX is in the CSS file `src/manify_assets/public/styles.css`  


## Background info

Magnify is based on two key technologies:

- [WebRTC](https://webrtc.org/)
- [DFINITY Internet Computer](https://sdk.dfinity.org/developers-guide/quickstart.html)

## Created by

Magnify was created by a multi-national group of rebels called "Team Phantomias." 

