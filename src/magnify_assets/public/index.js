import magnify from 'ic:canisters/magnify';

// magnify.greet(window.prompt("Enter your name:")).then(greeting => {
//   window.alert(greeting);
// });

magnify.ping().then(caller => {
  document.body.innerHTML = `Hallo ${caller._idHex}`;
  magnify.offer(caller, "sdp").then(
    () => magnify.offers().then(
      offers => {
        console.log(offers);
        magnify.answer(caller, "sdp answer").then(
          () => {
            magnify.offers().then(console.log);
            magnify.answers().then(console.log);
          }
        )
      }
    )
  )
})

