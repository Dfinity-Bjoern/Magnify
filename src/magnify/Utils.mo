import List "mo:base/List";

module{
    public func listKeep<T>(list: List.List<T>, predicate: (T) -> Bool) : List.List<T> {
        List.filter(list, func (t : T) : Bool {
            not predicate(t)
        })
    }
}
