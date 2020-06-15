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
let initiatorTimer
let waitForIceDelay
let iceCones = []

const onTrack = event => {
  console.log("addtrack")

  if (!remoteStream) {
    remoteStream = new MediaStream()
  }

  remoteVideo.srcObject = remoteStream
  remoteStream.addTrack(event.track, remoteStream)
}

// Needed for cross-machine calls
const onIceCandidate = event => {
  console.log("onIceCandidate:", event)
  if (event.candidate) {
    iceCones.push({
      label: event.candidate.sdpMLineIndex,
      candidate: event.candidate.candidate
    })
  }
}

const sendOffer = recipient => {
  // TODO(Christoph): video to true
  navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
    console.log("stream", stream)
    localStream = stream
    localVideo.srcObject = stream

    rtcPeerConnection = new RTCPeerConnection(iceServers)
    rtcPeerConnection.onicecandidate = onIceCandidate
    rtcPeerConnection.ontrack = onTrack

    for (const track of localStream.getTracks()) {
      rtcPeerConnection.addTrack(track);
    }

    rtcPeerConnection.createOffer().then(offer => {
      return rtcPeerConnection.setLocalDescription(offer)
    }).then(() => {
      waitForIceDelay = setTimeout(() => {
        magnify.offer(recipient, JSON.stringify({
          ice: iceCones,
          description: rtcPeerConnection.localDescription
        }))
      }, 2000)
    })
    .catch(e => console.log(e))

    initiatorTimer = setInterval(pollAnswer, 1000)
  })
  .catch(err => console.error(`Failed to connect 1: ${err}`))
}

const pollAnswer = () => {
  console.log("pollAnswer")
  let answers = magnify.answers().then(answers => {
    console.log(answers.length)
    if (answers.length > 0) {
      var details = JSON.parse(answers[0].answer)
      rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(details.description))
      for (const c of details.ice) {
        const candidate = new RTCIceCandidate({
          sdpMLineIndex: c.label,
          candidate: c.candidate
        })
        rtcPeerConnection.addIceCandidate(candidate)
      }
      clearInterval(initiatorTimer)
    }
  })
}

const sendAnswer = () => {
  const offer = allOffers[0]
  navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
    console.log("answer stream", stream)
    localStream = stream
    localVideo.srcObject = stream

    rtcPeerConnection = new RTCPeerConnection(iceServers)
    rtcPeerConnection.onicecandidate = onIceCandidate
    rtcPeerConnection.ontrack = onTrack

    for (const track of localStream.getTracks()) {
      rtcPeerConnection.addTrack(track)
    }

    console.log("offer.offer", offer.offer)
    var details = JSON.parse(offer.offer)
    console.log("Done parsing")
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(details.description))
    console.log("setting ice")
    for (const c of details.ice) {
      const candidate = new RTCIceCandidate({
        sdpMLineIndex: c.label,
        candidate: c.candidate
      })
      rtcPeerConnection.addIceCandidate(candidate)
    }

    console.log("creating answer")
    rtcPeerConnection.createAnswer().then(answer => {
      console.log("setting local desc")
      return rtcPeerConnection.setLocalDescription(answer)
    }).then(() => {
      waitForIceDelay = setTimeout(() => {
        magnify.answer(offer.initiator, JSON.stringify({
          description: rtcPeerConnection.localDescription,
          ice: iceCones
        }))
      }, 2000)
    })
    .catch(e => console.log(e))
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