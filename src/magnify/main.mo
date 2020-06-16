import List "mo:base/List";
import Option "mo:base/Option";
import Utils "Utils";

actor {

    //1. TYPES

    type RoomId = Nat;

    //1.1 Every offer has one initiator, one recipient, and belongs to one room
    type Offer = {
        initiator : Principal;
        recipient : Principal;
        offer : Text;
        roomId : RoomId;
    };

    //1.2 Every answer relates to one offer
    type Answer = {
        offer : Offer;
        answer : Text;
    };

    //1.3 Every participant has a principal and a name
    type Participant = {
        principal : Principal;
        alias : Text;
    };

    // 1.4 A room has an identifier and a list of participants
    type Room = {
        roomId : RoomId;
        participants : List.List<Participant>;
    };

    //2. OUR STATE

    //2.1 A List of offers which have not been accepted
    flexible var openOffers : List.List<Offer> = List.nil();

    //2.2 A List of acceptances
    flexible var acceptances : List.List<Answer> = List.nil();

    //2.3 The most recent room identifier and the list of available rooms
    flexible var roomIdSupply : Nat = 0;
    flexible var rooms : List.List<Room> = List.nil();

    // Increase the latest room identifier and return
    func freshRoomId() : Nat {
        roomIdSupply += 1;
        roomIdSupply
    };

    //3. OUR APIS

    //3.1 UPDATE function that creates a new room. Sets the alias of the creator
    // of the room and returns the room identifier.
    public shared {caller} func createRoom(creatorAlias : Text) : async RoomId {
        let room = freshRoomId();
        rooms := List.push({ roomId = room; participants = List.singleton({
            principal = caller;
            alias = creatorAlias;
        })}, rooms);
        room
    };

    //3.2 QUERY function that returns an array containing all room identifiers.
    public query func listAllRooms() : async [RoomId] {
        List.toArray(List.map(rooms, func({ roomId }: Room): RoomId = roomId))
    };

    public query {caller} func listRooms() : async [RoomId] {
        List.toArray(
            List.map(
                List.filter(rooms, func (r : Room) : Bool { isParticipantInRoom(caller, r.roomId) }),
                func({ roomId }: Room): RoomId = roomId
            )
        )
    };

    //3.3 QUERY function that returns the list of participants of a given room.
    // Returns null if the room does not exist.
    public query func participants(room : RoomId) : async (?[Participant]) {
        switch(findRoom(room)) {
            case null null;
            case (?r) ?(List.toArray(r.participants));
        }
    };

    //3.4 QUERY function for the front-end to get the Principal ID assigned to that user/caller
    //typially used when the user sets their alias at the beginning
    public query {caller} func ping() : async Principal {
        return caller
    };

    //3.5 This UPDATE function is used by a user to send an "offer" to a second party to initiate the
    // the video chat connection. Once the first user creates an offer, it is stored in the canister...
    // but it the parties are not YET connected. The second party must explicitly "answer" the offer.
    // The usual flow is thus like this:
    // 1. Alice sends Offer to Bob
    // 2. Bob answers Alice's offer
    // 3. Alice and Bob are now connected
    //
    // The offer is tied to a given room. The initiator must be in the room already. The recipient
    // is added to the room if necessary. In that case, the partnerName specified by the initiator
    // is used as the alias of the recipient. If the offer already exists in that room in either
    // the same or the opposite direction, adding it again fails.
    public shared {caller} func offer(room : RoomId, partner : Principal, partnerName : ?Text, sdp : Text) : async (?Text) {
        if (Option.isNull(findRoom(room))) {
            return ?"Room not found"
        };

        if (Option.isSome(List.find(openOffers, func (o : Offer) : Bool { 
            o.roomId == room and 
            (
              (o.initiator == caller and o.recipient == partner) or 
              (o.initiator == partner and o.recipient == caller)
            )
        }))) {
            return ?"Already existing offer"
        };
        
        if (not isParticipantInRoom(caller, room)) {
            return ?"Caller not in room"
        };

        if (not isParticipantInRoom(partner, room)) {
            let name = switch (partnerName) {
                case null return ?"No alias for partner given";
                case (?name) name;
            };
            updateRoom(room, func(r : Room) : Room { 
                { roomId = r.roomId; 
                    participants = List.push({
                      principal = partner;
                      alias = name;
                    }, r.participants);
                } 
            })
        };

        openOffers := List.push({
            roomId = room;
            initiator = caller;
            recipient = partner;
            offer = sdp;
        }, openOffers);
        null
    };

    //3.6 QUERY function to return the offers for the caller
    public query {caller} func offers(room : RoomId) : async [Offer] {
        return List.toArray(
            List.filter(openOffers, func (offer : Offer) : Bool {
                offer.roomId == room and offer.recipient == caller
            })
        );
    };

    //3.7 The arguments of this UPDATE function specify the room and the initiator whose offer
    // we want to accept. This function is used only on existing offers. Once a user accepts
    // an offer, then they will be connected via WebRTC for video chat. They will not be
    // connected until the offer is answered. The usual flow is thus like this:
    // 1. Alice sends Offer to Bob
    // 2. Bob answers Alice's offer
    // 3. Alice and Bob are now connected
    public shared {caller} func answer(room : RoomId, partner : Principal, sdp : Text) : async ?Text {
        if (Option.isNull(findRoom(room))) {
            return ?"Room not found"
        };
        
        let offer = List.find(openOffers, matchOffer(room, partner, caller));

        switch offer {
            case null ?"No offer found";
            case (?myOffer) {
                openOffers := Utils.listKeep(openOffers, matchOffer(room, partner, caller));
                acceptances := List.push({
                    offer = myOffer;
                    answer = sdp;
                }, acceptances);
                null
            }
        }
    };

    //3.8 This QUERY function returns the answers for the caller
    public query {caller} func answers(room : RoomId) : async [Answer] {
        return List.toArray(
            List.filter(acceptances, func (answer : Answer) : Bool {
                answer.offer.roomId == room and answer.offer.initiator == caller
            })
        );
    };

    //4. HELPER FUNCTIONS

    //4.1 A helper function used to check the list of offers and return those with the same
    //(initiator, recipient) tuple
    func matchOffer(room : RoomId, initiator : Principal, recipient : Principal) : (Offer) -> Bool {
        func (offer : Offer) : Bool =
            offer.roomId == room and offer.initiator == initiator and offer.recipient == recipient
    };

    //4.2 Helper function that checks whether a principal is in a given room
    func isParticipantInRoom(participant : Principal, room : RoomId) : Bool {
        switch (findRoom(room)) {
            case null false;
            case (?room) {
                Option.isSome(
                    List.find(room.participants, func (p : Participant): Bool = p.principal == participant)
                )
            }
        }
    };

    //4.3 Helper function that searches the list of all rooms for a specific one
    func findRoom(room : RoomId) : ?Room {
        List.find(rooms, func ({ roomId }: Room): Bool = room == roomId);
    };

    //4.4 Helper function that updates one room in the list. The room is identified
    // by its identifier, and the function Room -> Room specifies the change
    func updateRoom(room : RoomId, f : (Room) -> Room) {
        rooms := List.map(rooms, func (r : Room): Room { 
            if (r.roomId == room) { 
                f(r) 
            } else { 
                r
            } })
    };
};
