actor {

    public query {caller} func ping() : async Principal {
        return caller
    }

    // public query {caller} func offer(partner : Principal, sdp : Text) {

    // }

};
