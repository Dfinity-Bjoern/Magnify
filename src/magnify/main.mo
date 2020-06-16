import List "mo:base/List";
import Utils "Utils";

actor {

    //1. TYPES

    //1.1 Every offer is currently one to one so it has one initiator and one recipient
    type Offer = {
        initiator : Principal;
        recipient : Principal;
        offer : Text;
        initiatorAlias: Text;
    };

    //1.2 Every answer has only one offer and one person who can answer
    type Answer = {
        offer : Offer;
        answer : Text;
        answererAlias: Text;
    };

    //2. OUR STATE

    //2.1 A List of offers which have not been accepted
    flexible var openOffers : List.List<Offer> = List.nil();

    //2.2 A List of acceptances
    flexible var acceptances : List.List<Answer> = List.nil();

    //3. OUR APIS

    //3.1 QUERY function for the front-end to get the Principal ID assigned to that user/caller
    //typially used when the user sets their alias at the beginning
    public query {caller} func ping() : async Principal {
        return caller
    };

    //3.2 This UPDATE function is used by a user to send an "offer" to a second party to initiate the
    //the video chat connection. Once the first user creates an offer, it is stored in the canister...
    //but it the parties are not YET connected. The second party must explicitly "answer" the offer.
    //The usual flow is thus like this:
    //1. Alice sends Offer to Bob
    //2. Bob answers Alice's offer
    //3. Alice and Bob are now connected
    public shared {caller} func offer(partner : Principal, initiatorName: Text, sdp : Text) : async () {
        openOffers := List.push({
            initiator = caller;
            recipient = partner;
            offer = sdp;
            initiatorAlias = initiatorName;
        }, openOffers);
    };

    //3.3 QUERY function to return the offers for the caller
    public query {caller} func offers() : async [Offer] {
        return List.toArray(
            List.filter(openOffers, func (offer : Offer) : Bool {
                offer.recipient == caller
            })
        );
    };

    //3.4 this UPDATE function's argument is the index of the offers array that we should be accepting
    //This function is used only on existing offers. Once a user accepts an offer, then they will
    //be connected via WebRTC for video chat. They will not be connected until the offer is answered.
     //The usual flow is thus like this:
    //1. Alice sends Offer to Bob
    //2. Bob answers Alice's offer
    //3. Alice and Bob are now connected
    public shared {caller} func answer(partner : Principal, answererAliasName: Text, sdp : Text) : async ?Text {
        let offer = List.find(openOffers, matchOffer(partner, caller));

        switch offer {
            case null ?"No offer found";
            case (?myOffer) {
                openOffers := Utils.listKeep(openOffers, matchOffer(partner, caller));
                acceptances := List.push({
                    offer = myOffer;
                    answer = sdp;
                    answererAlias = answererAliasName;
                }, acceptances);
                null
            }
        }
    };

    //3.5 This QUERY function returns the answers for the caller
    public query {caller} func answers() : async [Answer] {
        return List.toArray(
            List.filter(acceptances, func (answer : Answer) : Bool {
                answer.offer.initiator == caller
            })
        );
    };

    //4. HELPER FUNCTIONS

    //4.1 A helper function used to check the list of offers and return those with the same
    //(initiator, recipient) tuple
    func matchOffer(initiator : Principal, recipient : Principal) : (Offer) -> Bool {
        func (offer : Offer) : Bool =
            offer.initiator == initiator and offer.recipient == recipient
    };

};
