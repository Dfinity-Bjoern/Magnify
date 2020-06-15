import magnify from 'ic:canisters/magnify';
import { CanisterId } from '@dfinity/agent';

const $ = document.querySelector.bind(document);

// Sadness
const principalFromHex = hex => CanisterId.fromHex(hex)

document.body.innerHTML = /*html*/`
  <div id="callerId"> Hello (Loading ...)</div>
  <label for=partnerInput>Partner:</label>
  <input id="partnerInput">
  <button id="offerButton" type="button">Offer</button>
  <button id="answerButton" type="button">Answer</button>
  <button id="listOffersButton" type="button">List offers</button>
  <button id="listAnswersButton" type="button">List answers</button>
  <h2>Offers:</h2>
  <ul id="offers"></ul>
  <h2>Answers:</h2>
  <ul id="answers"></ul>
  <div>
    <video id="localVideo" autoplay></video>
    <video id="remoteVideo" autoplay></video>
  </div>
`;

let allOffers = []

let localStream
let localVideo = $("#localVideo")
let remoteStream
let remoteVideo = $("#remoteVideo")
let rtcPeerConnection
let iceServers = { iceServers: [{ urls: "stun:stun.services.mozilla.com" }] }

const onAddStream = event => {
  remoteVideo.srcObject = event.stream
  remoteStream = event.stream
}

// Needed for cross-machine calls
const onIceCandidate = event => {
  console.log("onIceCandidate:", event)
}

const setLocalAndOffer = recipient => sessionDescription => {
  rtcPeerConnection.setLocalDescription(sessionDescription)
  magnify.offer(recipient, JSON.stringify(sessionDescription))
}

const setLocalAndAnswer = initiator => sessionDescription => {
  rtcPeerConnection.setLocalDescription(sessionDescription)
  magnify.answer(initiator, JSON.stringify(sessionDescription))
}

const sendOffer = recipient => {
  // TODO(Christoph): video to true
  navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
    console.log("stream", stream)
    localStream = stream
    localVideo.srcObject = stream

    rtcPeerConnection = new RTCPeerConnection(iceServers)
    rtcPeerConnection.onicecandidate = onIceCandidate
    rtcPeerConnection.onaddstream = onAddStream

    // rtcPeerConnection.addStream(localStream)
    for (const track of localStream.getTracks()) {
      rtcPeerConnection.addTrack(track);
    }
    rtcPeerConnection.createOffer(setLocalAndOffer(recipient), e => console.log(e))
  })
  .catch(err => console.error(`Failed to connect 1: ${err}`))
}

const sendAnswer = () => {
  const offer = allOffers[0]
  navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
    console.log("answer stream", stream)
    localStream = stream
    localVideo.srcObject = stream

    rtcPeerConnection = new RTCPeerConnection(iceServers)
    rtcPeerConnection.onicecandidate = onIceCandidate
    rtcPeerConnection.onaddstream = onAddStream

    //rtcPeerConnection.addStream(localStream)
    for (const track of localStream.getTracks()) {
      rtcPeerConnection.addTrack(track)
    }

    console.log("offer.offer", offer.offer)
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offer.offer)))

    rtcPeerConnection.createAnswer(setLocalAndAnswer(offer.initiator), e => console.log(e))
  })
  .catch(err => console.error(`Failed to connect 2: ${err}`))
}

$("#offerButton").addEventListener("click", ev => {
  const callerId = $("#partnerInput").value;
  sendOffer(principalFromHex(callerId))
})

$("#answerButton").addEventListener("click", ev => {
  // TODO Actually select the offer you want to answer
  sendAnswer()
})

$("#listOffersButton").addEventListener("click", ev => {
  const ul = $("#offers");
  magnify.offers().then(offers => {
    allOffers = offers
    ul.textContent = '';
    offers.forEach(offer => {
      console.log(offer)
      const newLi = document.createElement("li")
      newLi.textContent = `${offer.initiator._idHex} => ${offer.recipient._idHex}`
      ul.appendChild(newLi)
    })
  })
})

$("#listAnswersButton").addEventListener("click", ev => {
  const ul = $("#answers");
  magnify.answers().then(answers => {
    ul.textContent = '';
    answers.forEach(answer => {
      const newLi = document.createElement("li")
      newLi.textContent = `${answer.offer.initiator._idHex} => ${answer.offer.recipient._idHex}`
      ul.appendChild(newLi)
    })
  })
})

magnify.ping().then(caller => {
  $("#callerId").innerText = `Hello ${caller._idHex}`
})