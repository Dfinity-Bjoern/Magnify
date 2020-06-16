# magnify

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

There are really only two files that an application developer would touch:

1. Backend: The backend logic is in the Motoko-language file of the Canister `src/magnify/main.mo`
2. Frontend: The frontend (UX) is in the JavaScript file `src/manify_assets/public/index.js`

## Background info

Magnify is based on two key technologies:

- [WebRTC](https://webrtc.org/)
- [DFINITY Internet Computer](https://sdk.dfinity.org/developers-guide/quickstart.html)

