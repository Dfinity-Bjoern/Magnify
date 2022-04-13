import { Magnify } from "../../declarations/Magnify";
import "./styles.css"
import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from "@dfinity/principal";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import {
  idlFactory as magnify_idl,
  canisterId as magnify_id,
} from "../../declarations/magnify";


// Setting up interaction with Principal
function newIdentity() {
  const entropy = crypto.getRandomValues(new Uint8Array(32));
  const identity = Ed25519KeyIdentity.generate(entropy);
  localStorage.setItem("magnify", JSON.stringify(identity));
  return identity;
}

function readIdentity() {
  const stored = localStorage.getItem("magnify");
  if (!stored) {
    return newIdentity();
  }
  try {
    return Ed25519KeyIdentity.fromJSON(stored);
  } catch (error) {
    console.log(error);
    return newIdentity();
  }
}
const identity = readIdentity();
const principal_ = identity.getPrincipal();
console.log("Principal", principal_);

const agent = new HttpAgent({ identity });
agent.fetchRootKey();
const magnify = Actor.createActor(magnify_idl, {
  agent,
  canisterId : magnify_id
});

//0. PREP WORK & WORK AROUNDS
// This is ergonomic short-hand so we do not need to have to keep writing "document.."
const $ = document.querySelector.bind(document);

// Adds fonts
const link = document.createElement('link');
link.setAttribute('rel', 'stylesheet');
link.setAttribute('type', 'text/css');
link.setAttribute('href', 'https://fonts.googleapis.com/css2?family=Comic+Neue&family=Parisienne&display=swap');
document.head.appendChild(link);

// Sadness :(
// We have to do this as a work-around because there is a bug in Candid currently
// const principalFromHex = hex => CanisterId.fromHex(hex)

//1. HTML FOR THE FRONT-END
// Note that the HTML is a string... that is because (for security reasons) we can only have index.js
// This means our two options are either: 
//  a. create an in-line string like below
//  b. use some framework like React.js where we can have embedded HTML within JS
// We opted for inline string for simplicity for the sake of Hackathon.

const welcomePage = /*html*/`
<main role="main" class="welcomePage">
  <h1 class="heading">Magnify</h1>
  <h2>Join a room&hellip;</h2>
  <ul id="roomList">
    <li class="room-item__disabled">Loading&hellip;</li>
  </ul>
  <h2>&hellip; or create a new one</h2>
  <div class="new-room-controls">
    <input id="newRoomName" placeholder="New Room" />
    <input id="newRoomUser" placeholder="Your name"/>
    <button id="createNewRoom">Create</button>
  </div>
  <h2 class="principalHeader">&hellip; or let someone invite you by giving them this long string of nonsense which is your "Principal":</h2>
  <p id="principalDisplay">Loading...</p>
</main>
`;

const videoPage = /*html*/`
<main role="main" class="videoPage">
  <h1 class="heading">Magnify</h1>
  <div id="videos" class="flex-container">
    <div>
      <video id="localVideo" autoplay muted controls></video>
      <br/>
      <span id="mylabel"></span>
    </div>
  </div>

  <div id="inviteControls">
    <input id="inviteName" placeholder="Invitee name" />
    <input id="invitePrincipal" placeholder="Invitee Principal"/>
    <button id="invite">Invite</button>
  </div>
</main>
 `;


//2. VARIABLES
// Variables Data stored in the local instantiation of the front-end
// The purpose of this is to be able to retrieve variables like "callerId"
// across multiple JS functions... without having to re-read the HTML.

// Variables related to application logic. Store results from querying the canister.
let callerId = principal_.toHex();
let activeRoom;
let remotes = []

// Variables related to WebRTC
let localStream
let localVideo

// Variables to access html in frontend
//const welcomePage = document.getElementsByClassName("welcomePage");
//const videoPage = document.getElementsByClassName("videoPage");

//We have multiple servers here because as we were testing, the Mozilla STUN server crashed...
//So we use multiple for redundancy now
const iceServers = { iceServers: [
  { urls: "stun:stun.services.mozilla.com" },
  { urls: "stun:stun.l.google.com:19302" },
] }

// Timer for polling for new participants
let pollForAdditionsTimer

//3. FUNCTIONS

//3.1 sendOffer() -> () 
//This function is used by a user to send an "offer" to a second party to initiate the
//the video chat connection. Once the first user creates an offer, it is stored in the canister...
//but it the parties are not YET connected. The second party must explicitly "answer" the offer.
//The usual flow is thus like this:
//1. Alice sends Offer to Bob
//2. Bob answers Alice's offer
//3. Alice and Bob are now connected
const sendOffer = (recipient, alias) => {
  console.log(`Sending offer to ${recipient}`)
  
  setupPeerAndComplete(remote => {
    remote.idHex = Principal.fromHex(String(recipient)).toHex()
    remote.label.innerText = alias
    remote.rtcPeerConnection.createOffer().then(offer => {
      return remote.rtcPeerConnection.setLocalDescription(offer)
    }).then(() => {
      remote.waitForIceDelay = setTimeout(() => {
        console.log("The recipient's principal is", String(recipient))
        console.log("The recipient's hex is: ", recipient)
        magnify.offer(activeRoom, Principal.fromHex(String(recipient)), [alias], JSON.stringify({
          ice: remote.iceCandidates,
          description: remote.rtcPeerConnection.localDescription
        }))
      }, 2000)
    })
    .catch(e => console.log(e))

    // Poll the answers until our offer is accepted. This should have a timeout at
    // some point.
    remote.initiatorTimer = setInterval(() => {
      magnify.answers(activeRoom).then(answers => {
        console.log(`Found ${answers.length} answers on the canister`)
        for (const answer of answers) {
          // if (answer.offer.recipient.toHex() === recipient && !remotes.some(remote => remote.idHex === answer.offer.initiator.toHex())) {
            var details = JSON.parse(answer.answer)
            remote.rtcPeerConnection.setRemoteDescription(details.description)
            addRemoteIceCandidates(details.ice, remote.rtcPeerConnection)
            clearInterval(remote.initiatorTimer)
          // }
        }
      })
    }, 1000)
  })
}

//3.2 sendAnswer(offerIndex: Integer) -> ()
//this function's argument is the index of the offers array that we should be accepting
//This function is used only on existing offers. Once a user accepts an offer, then they will
//be connected via WebRTC for video chat. They will not be connected until the offer is answered.
const sendAnswer = (offer) => {
  console.log(`sending answer to ${offer.initiator._idHex}`);

  setupPeerAndComplete(remote => {
    remote.idHex = offer.initiator.toHex()

    var details = JSON.parse(offer.offer)
    remote.rtcPeerConnection.setRemoteDescription(details.description)
    addRemoteIceCandidates(details.ice, remote.rtcPeerConnection)

    // Set the name of the remote participant
    magnify.participants(activeRoom).then(participants => {
      remote.label.innerText = participants[0].find(p => p.principal.toHex() === offer.initiator.toHex()).alias
    })

    remote.rtcPeerConnection.createAnswer().then(answer => {
      return remote.rtcPeerConnection.setLocalDescription(answer)
    }).then(() => {
      waitForIceDelay = setTimeout(() => {
        magnify.answer(activeRoom, offer.initiator, JSON.stringify({
          description: remote.rtcPeerConnection.localDescription,
          ice: remote.iceCandidates
        }))
      }, 2000)
    })
    .catch(e => console.log(e))
  })
}

// Set up a room and continue
function setupRoomLocalAnd(completion) {
  navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
    localStream = stream
    localVideo.srcObject = stream

    completion()
    pollForAdditionsTimer = setInterval(checkForAdditions, 5000)
  }).catch(err => console.error(`Failed to connect 1: ${err}`))
}

function checkForAdditions() {
  // Check whether there are outstanding offers
  magnify.offers(activeRoom).then(offers => {
    console.log(`Found ${offers.length} offers`)
    offers.forEach(offer => {
      if (!remotes.some(remote => remote.idHex === offer.initiator.toHex()) && offer.initiator.toHex() != callerId) {
        sendAnswer(offer)
      }
    })
  })

  // Check whether we should be sending an offer
  magnify.participants(activeRoom).then(participants => {
    console.log("These are the participants: ", participants)
    console.log("remotes: ", remotes)
    for (const participant of participants[0]) {
      if (!remotes.some(remote => remote.idHex === participant.principal.toHex()) && participant.principal.toHex() != callerId) {
        console.log(`Sending an offer to ${participant.alias} (${participant.principal})`)       
        sendOffer(participant.principal, participant.alias)
      }
    }
  })
}

// Set up the local streaming and execute the completion
const setupPeerAndComplete = (completion) => {
  var remote = {
    rtcPeerConnection: new RTCPeerConnection(iceServers),
    iceCandidates: [],
    video: document.createElement("video"),
    stream: new MediaStream(),
    label: document.createElement("span"),
    idHex: '',

    initiatorTimer: null,
    waitForIceDelay: null
  }

  let videoDiv = document.createElement("div")
  videoDiv.appendChild(remote.video)
  videoDiv.appendChild(document.createElement("br"))
  videoDiv.appendChild(remote.label)

  // Add video element
  // remote.video.id = "remoteVideo-x"
  //if(!remotes.some(remote => remote.idHex))) {
    remote.video.autoplay = true
    remote.video.controls = true
    $("#videos").appendChild(videoDiv)
  //}


  // Set ICE handler for that remote. Needed for cross-machine calls
  // "ICE" is a concept for the WebRTC protocol.
  // ICE utilizes different technologies and protocols to overcome the challenges posed 
  // by different types of NAT mappings
  // It can be simplified with this example: 
  // a user is behind a firewall with many machines, but wants to establish a P2P connection 
  //ICE is critical for WebRTC: https://temasys.io/webrtc-ice-sorcery/
  remote.rtcPeerConnection.onicecandidate = event => {
    console.log("onIceCandidate:", event)
    if (event.candidate) {
      remote.iceCandidates.push({
        label: event.candidate.sdpMLineIndex,
        candidate: event.candidate.candidate
      })
    }
  }

  // Set track handler for that remote. Receiving a track (i.e. audio or video data stream)
  // from the remote partner, add it to the video display.
  remote.rtcPeerConnection.ontrack = event => {
    remote.video.srcObject = remote.stream
    remote.stream.addTrack(event.track, remote.stream)
  }

  // Add local tracks to the remote connection
  for (const track of localStream.getTracks()) {
    remote.rtcPeerConnection.addTrack(track);
  }

  if(!remotes.includes(remote)) {
    remotes.push(remote)
  }

  completion(remote)
}

// Add ICE candidates received from the partner to local WebRTC object
const addRemoteIceCandidates = (candidates, rtcPeerConnection) => {
  for (const c of candidates) {
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: c.label,
      candidate: c.candidate
    })
    rtcPeerConnection.addIceCandidate(candidate)
  }
}

//4. UI AND EVENT HANDLERS

// Helper function that loads the room list from the canister and creates join-buttons in the HTML
function refreshRooms(rooms) {
  const ul = $("#roomList");
  if (!ul) return
  ul.textContent = '';
  if (rooms.length === 0) {
    const newLi = document.createElement("li")
    newLi.className = "room-item__disabled"
    newLi.disabled = true
    newLi.textContent = "No rooms available";
    ul.appendChild(newLi);
  }
  rooms.forEach(room => {
    const newLi = document.createElement("li")
    newLi.className = "room-item"
    newLi.textContent = `${room[1]} (${room[0]})`;
    newLi.addEventListener("click", () => {
        activeRoom = room[0]
        setupVideoPage()
      })
    ul.appendChild(newLi);
  })
}

//5. THING TO CALL AT ONLOAD

//5.1 This part is executed when the JS loads, the front-end asks the canister for a principal ID
// it can use in future calls as an identifier. It also loads the initial room list.
let roomPollingInterval;

function setupWelcomePage() {
  document.body.innerHTML = welcomePage
  const createButton = $("#createNewRoom")
  const newRoomName = $("#newRoomName")
  const newRoomUser = $("#newRoomUser")

  roomPollingInterval = setInterval(() => {
    magnify.listRooms().then(rooms => refreshRooms(rooms))
  }, 2000);

  createButton.addEventListener("click", ev => {
    if (createButton.disabled) {
      ev.stopPropagation()
      ev.preventDefault()
    } else {
      let roomname = newRoomName.value
      let alias = newRoomUser.value;
      console.log("The alias: ", alias)
      magnify.createRoom(roomname, alias).then(room => {
        activeRoom = room
        setupVideoPage()
      })
    }
  })
}

function tearDownWelcomePage() {
  clearInterval(roomPollingInterval)
}

function setupVideoPage() {
  tearDownWelcomePage()
  document.body.innerHTML = videoPage
  localVideo = $("#localVideo")
  const inviteName = $("#inviteName")
  const invitePrincipal = $("#invitePrincipal")
  const inviteButton = $("#invite")

  setupRoomLocalAnd(() => {
    magnify.offers(activeRoom).then(offers => {
      console.log(`Found ${offers.length} offers`)
      offers.forEach(offer => sendAnswer(offer))
    })
    // Find my own nickname and set label accordingly
    magnify.participants(activeRoom).then(participants => {
      console.log("the participants are: ", participants[0][0].alias, " ", participants[0][0].principal, "callerId ", callerId  )
      $("#mylabel").innerText = participants[0].find(p => p.principal.toHex() === callerId).alias
    })
  })

  inviteButton.addEventListener("click", ev => {
    sendOffer(invitePrincipal.value, inviteName.value)
  })
}

let callerP = magnify.ping()
let roomsP = magnify.listRooms()

setupWelcomePage()
//callerP.then(caller => 
  roomsP.then(rooms => {
      console.log(`fetched the caller ID: ${principal_}`);
      //add it to the local variables (for easier retrieval in the front-end)
      //callerId = principal_.toHex();
      console.log("This is the current principal", callerId)
      $("#principalDisplay").innerText = callerId;
      refreshRooms(rooms)
})

