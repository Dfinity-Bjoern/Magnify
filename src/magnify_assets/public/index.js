import magnify from 'ic:canisters/magnify';
import { CanisterId } from '@dfinity/agent';

const $ = document.querySelector.bind(document);

// Sadness
const principalFromHex = hex => CanisterId.fromHex(hex)

document.body.innerHTML = /*html*/`
  <div id="callerId"> Hello (Loading ...)</div>
  <label for=recipientInput>Recipient:</label>
  <input id="recipientInput">
  <button id="recipientButton" type="button">Call</button>
  <button id="listOffersButton" type="button">List offers</button>
  <button id="listAnswersButton" type="button">List answers</button>
  <h2>Offers:</h2>
  <ul id="offers"></ul>
  <h2>Answers:</h2>
  <ul id="answers"></ul>
`;

const sendOffer = recipient => magnify.offer(recipient, "sdp")

$("#recipientButton").addEventListener("click", ev => {
  const callerId = $("#recipientInput").value;
  sendOffer(principalFromHex(callerId)).then(() => {
    console.log(`Sent an offer to: ${callerId}`)
  })
})

$("#listOffersButton").addEventListener("click", ev => {
  const ul = $("#offers");
  magnify.offers().then(offers => {
    ul.textContent = '';
    offers.forEach(offer => {
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

