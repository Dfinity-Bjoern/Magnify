import magnify from 'ic:canisters/magnify';
import "./styles.css"
import { CanisterId } from '@dfinity/agent';


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
const principalFromHex = hex => CanisterId.fromHex(hex)

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
  <h2 class="principalHeader">&hellip; or let someone invite you with</h2>
  <p id="principalDisplay">Loading...</p>
</main>
`;

const videoPage = /*html*/`
<main role="main" class="videoPage">
  <h1 class="heading">Magnify</h1>
  <div id="videos" class="flex-container">
    <video id="localVideo" autoplay muted controls></video>
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
let allOffers = []
let allRooms = []
let allParticipants = []
let callerId = 'TBD';
let activeRoom;
let myConnections = []

// Variables related to WebRTC
let localStream
let localVideo
let iceServers = { iceServers: [{ urls: "stun:stun.services.mozilla.com" }] }
var remotes = []

// Timers for polling and ICE handling
let initiatorTimer
let waitForIceDelay
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
  const recipientId = recipient._idHex
  myConnections.push(recipientId)
  console.log(`connecting to ${recipientId}`)
  setupPeerAndComplete(remote => {
    remote.rtcPeerConnection.createOffer().then(offer => {
      return remote.rtcPeerConnection.setLocalDescription(offer)
    }).then(() => {
      waitForIceDelay = setTimeout(() => {
        magnify.offer(activeRoom, recipient, [alias], JSON.stringify({
          ice: remote.iceCandidates,
          description: remote.rtcPeerConnection.localDescription
        }))
      }, 2000)
    })
    .catch(e => console.log(e))

    // Poll the answers until our offer is accepted. This should have a timeout at
    // some point.
    initiatorTimer = setInterval(() => {
      let answers = magnify.answers(activeRoom).then(answers => {
        console.log(`Found ${answers.length} answers on the canister`)
        for (const answer of answers) {
          if (answer.offer.recipient._idHex == recipient._idHex) {
            var details = JSON.parse(answer.answer)
            remote.rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(details.description)).then(() => {console.log("promise here")})
            addRemoteIceCandidates(details.ice, remote.rtcPeerConnection)
            clearInterval(initiatorTimer)
          }
        }
      })
    }, 1000)
  })
}

//3.2 sendAnswer(offerIndex: Integer) -> ()
//this function's argument is the index of the offers array that we should be accepting
//This function is used only on existing offers. Once a user accepts an offer, then they will
//be connected via WebRTC for video chat. They will not be connected until the offer is answered.
const sendAnswer = (offerIndex) => {
  const offer = allOffers[offerIndex];
  console.log(`sending answer for offer ${offerIndex} of ${allOffers.length}`);
  myConnections.push(offer.initiator._idHex)

  setupPeerAndComplete(remote => {
    var details = JSON.parse(offer.offer)
    remote.rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(details.description))
    addRemoteIceCandidates(details.ice, remote.rtcPeerConnection)

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
  // TODO(Christoph): video to true
  navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
    localStream = stream
    localVideo.srcObject = stream

    completion()
    pollForAdditionsTimer = setInterval(checkForAdditions, 5000)
  }).catch(err => console.error(`Failed to connect 1: ${err}`))
}

function checkForAdditions() {
  // See whether there are outstanding offers
  magnify.offers(activeRoom).then(offers => {
    console.log(`Found ${offers.length} offers`)
    allOffers = offers
    offers.forEach((offer, index) => {
      console.log("Sending an answer")
      sendAnswer(index)
    })
  })

  // See whether there are participants we're not connected with (and not callerId)
  magnify.participants(activeRoom).then(participants => {
    allParticipants = participants[0]
    for (const participant of allParticipants) {
      if (!isParticipantInConnections(participant.principal) && participant.principal._idHex != callerId) {
        console.log(`Sending an offer to ${participant.principal._idHex}`)
        sendOffer(participant.principal, participant.alias)
      }
    }
  })
}

function isParticipantInConnections(participant) {
  for (const connection of myConnections) {
    if (connection == participant._idHex) {
      return true
    }
  }
  return false
}

// Set up the local streaming and execute the completion
const setupPeerAndComplete = (completion) => {
  var remote = {
    rtcPeerConnection: new RTCPeerConnection(iceServers),
    iceCandidates: [],
    video: document.createElement("video"),
    stream: new MediaStream()
  }

  // Add video element
  // remote.video.id = "remoteVideo-x"
  remote.video.autoplay = true
  remote.video.controls = true
  $("#videos").appendChild(remote.video)

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

  remotes.push(remote)
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

// Helper function: search the alias of a participant in the list returned by the canister.
function getAliasForParticipant(principal) {
  console.log(principal)
  for (const participant of allParticipants) {
    if (participant.principal._idHex == principal._idHex) {
      return participant.alias
    }
  }
}

//4. UI AND EVENT HANDLERS

// Helper function that loads the room list from the canister and creates join-buttons in the HTML
function refreshRooms() {
  const ul = $("#roomList");
  if (!ul) return
  ul.textContent = '';
  if (allRooms.length === 0) {
    const newLi = document.createElement("li")
    newLi.className = "room-item__disabled"
    newLi.disabled = true
    newLi.textContent = "No rooms available";
    ul.appendChild(newLi);
  }
  allRooms.forEach(room => {
    const newLi = document.createElement("li")
    newLi.className = "room-item"
    newLi.textContent = room;
    newLi.addEventListener("click", () => {
        activeRoom = room
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
    magnify.listRooms().then(rooms => {
      allRooms = rooms;
      refreshRooms()
    })
  }, 2000);

  createButton.addEventListener("click", ev => {
    if (createButton.disabled) {
      ev.stopPropagation()
      ev.preventDefault()
    } else {
      // TODO use the room name
      let alias = newRoomUser.value;
      magnify.createRoom(alias).then(room => {
        allRooms.push(room)
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
      allOffers = offers
      offers.forEach((offer, index) => {
        sendAnswer(index)
      })
    })
    magnify.participants(activeRoom).then(participants => {
      allParticipants = participants[0]
      console.log(participants[0])
    })
  })

  inviteButton.addEventListener("click", ev => {
    sendOffer(principalFromHex(invitePrincipal.value), inviteName.value)
  })
}

let callerP = magnify.ping()
let roomsP = magnify.listAllRooms()

console.log("Hello friend")
setupWelcomePage()
callerP.then(caller => 
  roomsP.then(rooms => {
      // $("#callerId").innerText = `Hello ${caller._idHex}`;
      console.log(`fetched the caller ID: ${caller._idHex}`);
      //add it to the local variables (for easier retrieval in the front-end)
      callerId = caller._idHex;
      $("#principalDisplay").innerText = callerId;
      allRooms = rooms;
      refreshRooms()
}))


