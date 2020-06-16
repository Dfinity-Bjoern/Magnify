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

document.body.innerHTML = /*html*/`
<main>
  <div id="info">
    <div id="userInfo">
      <div id="callerId">Hello!!</div>
    </div>
  </div>
  <br>
  <div id="roomControls">
    <label id="aliasInputLabel" for=aliasInput>Input your Alias:</label>
    <input id="aliasInput">
    <button id="createRoomButton">Create Room</button>
    <button id="refreshRoomList">Refresh Rooms</button>
    <ul id="roomList"></ul>
  </div>
  <div id="controls" hidden="true">
    <label for=partnerInput>Partner:</label>
    <input id="partnerInput">
    <label if="partnerAliasLabel" for=partnerAlias>Alias:</label>
    <input id="partnerAlias">
    <button id="offerButton" type="button">Offer</button>
    <button id="answerButton" type="button">Answer</button>
    <button id="listOffersButton" type="button">List offers</button>
    <button id="listAnswersButton" type="button">List answers</button>
    <h2>Offers:</h2>
    <ul id="offers"></ul>
    <h2>Answers:</h2>
    <ul id="answers"></ul>
  <div>
  <div id="videos" hidden="true">
    <video id="localVideo" autoplay muted></video>
    <video id="remoteVideo" autoplay></video>
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
let callerId =  'TBD';
let activeRoom;

// Variables related to WebRTC
let localStream
let localVideo = $("#localVideo")
let remoteStream = new MediaStream()
let remoteVideo = $("#remoteVideo")
let rtcPeerConnection
let iceServers = { iceServers: [{ urls: "stun:stun.services.mozilla.com" }] }
let iceCandidates = []

// Timers for polling and ICE handling
let initiatorTimer
let waitForIceDelay


//3. FUNCTIONS

//3.1 sendOffer() -> () 
//This function is used by a user to send an "offer" to a second party to initiate the
//the video chat connection. Once the first user creates an offer, it is stored in the canister...
//but it the parties are not YET connected. The second party must explicitly "answer" the offer.
//The usual flow is thus like this:
//1. Alice sends Offer to Bob
//2. Bob answers Alice's offer
//3. Alice and Bob are now connected
const sendOffer = recipient => {
  setupLocalAndComplete(() => {
    rtcPeerConnection.createOffer().then(offer => {
      return rtcPeerConnection.setLocalDescription(offer)
    }).then(() => {
      waitForIceDelay = setTimeout(() => {
        magnify.offer(activeRoom, recipient, [$("#partnerAlias").value], JSON.stringify({
          ice: iceCandidates,
          description: rtcPeerConnection.localDescription
        }))
      }, 2000)
    })
    .catch(e => console.log(e))

    // Poll the answers until our offer is accepted. This should have a timeout at
    // some point.
    initiatorTimer = setInterval(() => {
      let answers = magnify.answers(activeRoom).then(answers => {
        console.log(`Found ${answers.length} answers on the canister`)
        if (answers.length > 0) {
          var details = JSON.parse(answers[0].answer)
          rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(details.description))
          addRemoteIceCandidates(details.ice)
          clearInterval(initiatorTimer)
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

  setupLocalAndComplete(() => {
    var details = JSON.parse(offer.offer)
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(details.description))
    addRemoteIceCandidates(details.ice)

    rtcPeerConnection.createAnswer().then(answer => {
      return rtcPeerConnection.setLocalDescription(answer)
    }).then(() => {
      waitForIceDelay = setTimeout(() => {
        magnify.answer(activeRoom, offer.initiator, JSON.stringify({
          description: rtcPeerConnection.localDescription,
          ice: iceCandidates
        }))
      }, 2000)
    })
    .catch(e => console.log(e))
  })
}

// Receiving a track (i.e. audio or video data stream) from the remote
// partner, add it to the video display.
const onTrack = event => {
  remoteVideo.srcObject = remoteStream
  remoteStream.addTrack(event.track, remoteStream)
}

// Set up the local streaming and execute the completion
const setupLocalAndComplete = (completion) => {
  // TODO(Christoph): video to true
  navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
    localStream = stream
    localVideo.srcObject = stream

    rtcPeerConnection = new RTCPeerConnection(iceServers)
    rtcPeerConnection.onicecandidate = onIceCandidate
    rtcPeerConnection.ontrack = onTrack

    for (const track of localStream.getTracks()) {
      rtcPeerConnection.addTrack(track);
    }

    completion()
  }).catch(err => console.error(`Failed to connect 1: ${err}`))
}

// 3.5 onIceCandidate() is Needed for cross-machine calls
// "ICE" is a concept for the WebRTC protocol. 
// ICE utilizes different technologies and protocols to overcome the challenges posed 
// by different types of NAT mappings
// It can be simplified with this example: 
// a user is behind a firewall with many machines, but wants to establish a P2P connection 
//ICE is critical for WebRTC: https://temasys.io/webrtc-ice-sorcery/
const onIceCandidate = event => {
  console.log("onIceCandidate:", event)
  if (event.candidate) {
    iceCandidates.push({
      label: event.candidate.sdpMLineIndex,
      candidate: event.candidate.candidate
    })
  }
}

// Add ICE candidates received from the partner to local WebRTC object
const addRemoteIceCandidates = candidates => {
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

//4.1 This button is clicked by the caller to send an offer to a recipient
$("#offerButton").addEventListener("click", ev => {
  const callerId = $("#partnerInput").value;
  sendOffer(principalFromHex(callerId))
})

//4.2 This button is clicked by a recipient to answer an offer and join a WebRTC call
$("#answerButton").addEventListener("click", ev => {
  // TODO Actually select the offer you want to answer
  let offerIndex = 0;
  sendAnswer(offerIndex);
});

//4.3 This button is clicked by any user to see all the offers available
$("#listOffersButton").addEventListener("click", ev => {
  const ul = $("#offers");
  magnify.offers(activeRoom).then(offers => {
    allOffers = offers
    ul.textContent = '';

    offers.forEach((offer, index) => {
      console.log(`offer has index: ${index}`);
      console.log(offer);
      const newLi = document.createElement("li");
      newLi.textContent = `${getAliasForParticipant(offer.initiator)} => you    `;
      ul.appendChild(newLi);

      //add button so the user can answer the offer
      const newAnswerButton = document.createElement("button");
      newAnswerButton.id = `answerButton-${index}`;
      newAnswerButton.innerText = `Answer offer #${index} from ${getAliasForParticipant(offer.initiator)}`;
      newLi.appendChild(newAnswerButton);
      //we use const in order to avoid closure/scope unpredictability
      //we the closure scope in the addEventListener
      const offerIndex = index; 
      $(`#answerButton-${offerIndex}`).addEventListener("click", ev => {
        sendAnswer(offerIndex);
      });
    })
  })
})

//4.4 This button is clicked by any user to see all the answers available
$("#listAnswersButton").addEventListener("click", ev => {
  const ul = $("#answers");
  magnify.answers(activeRoom).then(answers => {
    ul.textContent = '';
    answers.forEach(answer => {
      const newLi = document.createElement("li")
      newLi.textContent = `${answer.offer.initiator._idHex} => ${answer.offer.recipient._idHex}`;
      ul.appendChild(newLi);
    })
  })
})

//4.5 This button is clicked to refresh the list of available rooms
$("#refreshRoomList").addEventListener("click", () => {
  magnify.listAllRooms().then(rooms => {
    allRooms = rooms
    refreshRooms()
  })
})

//4.6 This button is clicked to create a new room
$("#createRoomButton").addEventListener("click", () => {
  let alias = $("#aliasInput").value;
  magnify.createRoom(alias).then(room => {
    allRooms.push(room)
    activeRoom = room
    displayVideos()
  })
})

// Helper function that hides the room controls and shows the video controls
function displayVideos() {
  $("#controls").hidden = false
  $("#videos").hidden = false
  $("#roomControls").hidden = true
}

// Helper function that loads the room list from the canister and creates join-buttons in the HTML
function refreshRooms() {
  const ul = $("#roomList");
  ul.textContent = '';
  allRooms.forEach(room => {
    const newLi = document.createElement("li")
    newLi.textContent = room;

    //add button so the user can answer the offer
    const useRoomButton = document.createElement("button");
    useRoomButton.innerText = "Join";
    newLi.appendChild(useRoomButton);
    useRoomButton.addEventListener("click", ev => {
      activeRoom = room
      displayVideos()
      magnify.participants(room).then(participants => {
        allParticipants = participants[0]
        console.log(participants[0])
      })
      // Auto-join if there are available offers
      magnify.offers(room).then(offers => {
        console.log(`Found ${offers.length} offers`)
        allOffers = offers
        offers.forEach((offer, index) => {
          sendAnswer(index)
        })
      })
    });
    ul.appendChild(newLi);
  })
}

//5. THING TO CALL AT ONLOAD

//5.1 This part is executed when the JS loads, the front-end asks the canister for a principal ID
// it can use in future calls as an identifier. It also loads the initial room list.

let callerP = magnify.ping()
let roomsP = magnify.listAllRooms()
callerP.then(caller => 
  roomsP.then(rooms => {
      // $("#callerId").innerText = `Hello ${caller._idHex}`;
      console.log(`fetched the caller ID: ${caller._idHex}`);
      //add it to the local variables (for easier retrieval in the front-end)
      callerId = caller._idHex;
      $("#callerId").innerText = `Welcome, ${callerId}!`;
      allRooms = rooms;
      refreshRooms()
}))


