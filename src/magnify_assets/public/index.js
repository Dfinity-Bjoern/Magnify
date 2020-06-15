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
`;

const sendOffer = recipient => magnify.offer(recipient, "sdp")
const sendAnswer = initiator => magnify.answer(initiator, "answerSDP")

$("#offerButton").addEventListener("click", ev => {
  const callerId = $("#partnerInput").value;
  sendOffer(principalFromHex(callerId)).then(() => {
    console.log(`Sent an offer to: ${callerId}`)
  })
})

$("#answerButton").addEventListener("click", ev => {
  const partnerId = $("#partnerInput").value;
  sendAnswer(principalFromHex(partnerId)).then(() => {
    console.log(`Sent an answer to: ${partnerId}`)
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

