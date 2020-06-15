import List "mo:base/List";

actor {

    type Offer = {
        initiator : Principal;
        target : Principal;
        offer : Text;
    };

    flexible var openOffers : List.List<Offer> = List.nil();

    public query {caller} func ping() : async Principal {
        return caller
    };

    public shared {caller} func offer(partner : Principal, sdp : Text) : async () {
        openOffers := List.push({
            initiator = caller;
            target = partner;
            offer = sdp;
        }, openOffers);
    };

    public query func offers() : async [Offer] {
        return List.toArray(openOffers);
    };

};
