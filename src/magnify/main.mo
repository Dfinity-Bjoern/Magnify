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
    };

    flexible var openOffers : List.List<Offer> = List.nil();
    flexible var acceptances : List.List<Answer> = List.nil();

    public query {caller} func ping() : async Principal {
        return caller
    };

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

    public shared {caller} func answer(partner : Principal, sdp : Text) : async ?Text {
        let offer = List.find(openOffers, matchOffer(partner, caller));

        switch offer {
            case null ?"No offer found";
            case (?myOffer) {
                openOffers := Utils.listKeep(openOffers, matchOffer(partner, caller));
                acceptances := List.push({
                    offer = myOffer;
                    answer = sdp;
                }, acceptances);
                null
            }
        }
    };

    public query func answers() : async [Answer] {
        return List.toArray(acceptances);
    };

};
