import List "mo:base/List";
import Utils "Utils";

actor {

    type Offer = {
        initiator : Principal;
        recipient : Principal;
        offer : Text;
        initiatorAlias: Text;
    };

    type Answer = {
        offer : Offer;
        answer : Text;
        answererAlias: Text;
    };

    flexible var openOffers : List.List<Offer> = List.nil();
    flexible var acceptances : List.List<Answer> = List.nil();

    public query {caller} func ping() : async Principal {
        return caller
    };

    //This function is used by a user to send an "offer" to a second party to initiate the
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

    public query func offers() : async [Offer] {
        return List.toArray(openOffers);
    };

    func matchOffer(initiator : Principal, recipient : Principal) : (Offer) -> Bool {
        func (offer : Offer) : Bool =
            offer.initiator == initiator and offer.recipient == recipient
    };

    //this function's argument is the index of the offers array that we should be accepting
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

    public query func answers() : async [Answer] {
        return List.toArray(acceptances);
    };

};
