# iOS Interview Questions (174)

> Reviewed October 2026 against Apple documentation, Swift Evolution proposals, swift.org and WWDC sessions. See [Review notes & sources](#review-notes--sources) at the end.

- [Software Basics (10)](#software-basics-10)
- [Objective-C (8)](#objective-c-8)
- [Swift (13)](#swift-13)
- [UIKit (12)](#uikit-12)
- [SwiftUI (17)](#swiftui-17)
- [Protocols & POP (8)](#protocols--pop-8)
- [Memory & ARC (12)](#memory--arc-12)
- [Concurrency (17)](#concurrency-17)
- [Combine (14)](#combine-14)
- [Architecture (12)](#architecture-12)
- [Networking (9)](#networking-9)
- [Persistence (8)](#persistence-8)
- [Testing (7)](#testing-7)
- [Performance (8)](#performance-8)
- [Security & Tools (10)](#security--tools-10)
- [System Design (4)](#system-design-4)
- [Behavioral (5)](#behavioral-5)
- [Review notes & sources](#review-notes--sources)

## Software Basics (10)

### 1. What is the difference between stack and heap memory? `Basic`

**Short:** Stack: fast LIFO call frames, freed at scope exit. Heap: dynamic, ARC-managed. Value types usually inline, not always.

The stack holds function call frames and local values — LIFO, very fast, freed automatically when the scope exits. The heap holds dynamically allocated memory such as class instances — slower to allocate and reference-counted by ARC. Value types (structs, enums) are usually stored inline on the stack or inside their container, but they end up on the heap when stored in a class property, captured by an escaping closure, boxed in a large existential, or held in an Array's buffer. Class instances always live on the heap.

---

### 2. What does O(n²) time complexity mean? `Basic`

**Short:** Runtime quadruples when input doubles. Typical of nested loops. O(n) fix: use a Set.

Big O describes how runtime (or memory) grows as the input size *n* grows, ignoring constant factors and lower-order terms. Common classes, from best to worst:

- **O(1)** — constant: Dictionary/Set lookup (average case), array access by index.
- **O(log n)** — halves the problem each step: binary search on a sorted array.
- **O(n)** — one pass: `contains` on an Array, `map`, `filter`.
- **O(n log n)** — efficient comparison sorts such as Swift's `sort()`.
- **O(n²)** — quadratic: doubling the input quadruples the work. 1,000 items ≈ 1 million comparisons; 10,000 items ≈ 100 million.

Quadratic code usually hides in nested loops over the same collection, in calling an O(n) method (`contains`, `firstIndex(of:)`, `removeFirst()` on an Array) inside a loop, or in repeatedly inserting at the front of an Array. The usual fix trades memory for time: put elements in a `Set`/`Dictionary` (average O(1) lookups), or sort first and scan once. In an interview, also state the **space** complexity (the Set version uses O(n) extra memory) and mention best/average/worst case when they differ — e.g. hash lookups degrade to O(n) with many collisions.

```swift
// O(n²) — nested loop
func hasDuplicatesSlow(_ arr: [Int]) -> Bool {
  for i in 0..<arr.count {
    for j in (i + 1)..<arr.count where arr[i] == arr[j] {
      return true
    }
  }
  return false
}

// O(n) time, O(n) extra space — use a Set
func hasDuplicates(_ arr: [Int]) -> Bool {
  var seen = Set<Int>()
  for x in arr {
    if !seen.insert(x).inserted { return true }
  }
  return false
}
```

---

### 3. Explain the SOLID principles with an iOS example for each. `Intermediate`

**Short:** Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.

SOLID is five design principles that keep code easy to change and test. With an iOS example for each:

- **S — Single Responsibility:** a type should have one reason to change. A `ProfileViewController` that fetches JSON, parses it, caches it and formats dates has four. Split it into an `APIClient`, a `ProfileRepository`, a `DateFormatter` helper and a ViewModel; the VC only renders.
- **O — Open/Closed:** open for extension, closed for modification. Instead of a growing `switch paymentType` inside `CheckoutService`, define a `PaymentMethod` protocol; adding Apple Pay means adding a new conforming type, not editing existing code.
- **L — Liskov Substitution:** any subtype must work wherever its base type is expected, without surprises. A `ReadOnlyCache` subclass of `Cache` whose `save()` throws `fatalError` breaks LSP — callers of `Cache` can no longer trust `save()`. Model it as a separate protocol instead.
- **I — Interface Segregation:** many small protocols beat one fat one. UIKit itself splits `UITableViewDataSource` from `UITableViewDelegate`; in your code, prefer `Readable` and `Writable` storage protocols over one `StorageProtocol` with 15 methods, so mocks stay tiny.
- **D — Dependency Inversion:** high-level code depends on abstractions. The ViewModel depends on an `AuthServicing` protocol, and the app's composition root injects `FirebaseAuthService` (or a mock in tests).

Interview tip: don't just recite the acronym — pick one principle you actually applied and explain the before/after.

```swift
// Open/Closed + Dependency Inversion together
protocol PaymentMethod { func pay(_ amount: Decimal) async throws }
struct CardPayment: PaymentMethod { func pay(_ amount: Decimal) async throws { /* ... */ } }
struct ApplePayPayment: PaymentMethod { func pay(_ amount: Decimal) async throws { /* ... */ } }

final class CheckoutViewModel {
  private let payment: any PaymentMethod   // depends on the abstraction
  init(payment: any PaymentMethod) { self.payment = payment }
  func checkout(total: Decimal) async throws { try await payment.pay(total) }
}
```

---

### 4. What is dependency injection? What problem does it solve? `Intermediate`

**Short:** Pass dependencies in from outside rather than creating them internally. Enables mocking and loose coupling.

Dependency injection means an object **receives** its collaborators instead of creating them (`let api = APIClient()` inside the type is the anti-example). It solves three problems:

1. **Tight coupling** — the type only knows a protocol, so you can swap implementations (staging vs production, Firebase vs REST).
2. **Testability** — tests inject mocks/stubs, making them fast, deterministic and offline.
3. **Hidden dependencies** — the initializer documents exactly what the type needs.

Forms: **constructor injection** (preferred — dependencies are non-optional and immutable), **property injection** (needed when you don't control init, e.g. storyboard-created view controllers), and **method injection** (pass a dependency to a single call). In SwiftUI, `.environment(_:)` is a form of DI for values shared down the view tree.

All the concrete wiring should live in one **composition root** (App/SceneDelegate or the `App` struct, or a coordinator). Containers such as Factory, Swinject or Resolver automate this, but plain initializer injection is enough for most apps. Avoid the *service locator* pattern (a global registry everyone pulls from) — it is DI in name only, because dependencies are hidden again.

```swift
protocol APIClient { func fetch() async throws -> Data }

final class ProfileViewModel {
  private let api: APIClient            // abstraction, not URLSession
  init(api: APIClient) { self.api = api }
}

// Composition root (production)
let vm = ProfileViewModel(api: LiveAPIClient(session: .shared))
// Test
let testVM = ProfileViewModel(api: StubAPIClient(data: fixture))
```

---

### 5. What is a race condition? How do you prevent one? `Intermediate`

**Short:** Two threads access shared mutable state concurrently with a write. Outcome depends on timing.

A race condition happens when two or more threads access **shared mutable state** concurrently, at least one access is a **write**, and the outcome depends on the timing of the scheduler. Classic example: two threads run `count += 1` — that is read, add, write — so both may read 5 and both write 6, losing an increment. Races cause crashes that are hard to reproduce (corrupted arrays/dictionaries, `EXC_BAD_ACCESS`) and silently wrong data.

Ways to prevent them:

- **Actors** (modern default): the compiler enforces that isolated state is touched by one task at a time.
- **Serial DispatchQueue** used as a synchronizer (`queue.sync` for reads/writes), or a concurrent queue with `.barrier` writes for a reader–writer pattern.
- **Locks**: `NSLock`, `os_unfair_lock` / `OSAllocatedUnfairLock` (iOS 16), or `Mutex` from the Synchronization framework (iOS 18). Keep critical sections tiny.
- **Avoid sharing**: use value types and immutable data, and pass copies between threads.

Detect them with Xcode's **Thread Sanitizer** (Scheme → Diagnostics) and, in Swift 6 language mode, the compiler's strict concurrency checking. Note that actors remove *data races*, but higher-level race conditions are still possible through actor reentrancy (see Q88 and Q95).

```swift
actor Counter {
  private var count = 0
  func increment() { count += 1 }   // serialized by the actor
  func value() -> Int { count }
}

// Lock-based alternative (iOS 16+)
import os
let total = OSAllocatedUnfairLock(initialState: 0)
total.withLock { $0 += 1 }
```

---

### 6. What is the difference between REST and GraphQL? `Intermediate`

**Short:** REST: fixed resource endpoints. GraphQL: single endpoint, client declares exact data shape needed.

**REST** models the API as resources at fixed URLs (`GET /users/1`, `GET /users/1/posts`) and uses HTTP verbs and status codes for meaning. **GraphQL** exposes a single endpoint (usually `POST /graphql`) with a typed schema; the client sends a query describing exactly the fields it needs, and the server returns that shape.

Trade-offs worth naming:

- **Over-/under-fetching:** REST endpoints often return more than a screen needs, or force several round trips; GraphQL fetches a nested screen's data in one request with only the needed fields — valuable on slow mobile networks.
- **Caching:** REST gets HTTP caching (Cache-Control, ETag, CDNs) for free on GET requests. GraphQL usually goes over POST, so caching moves to the client — e.g. Apollo iOS's normalized cache.
- **Versioning:** REST commonly versions URLs (`/v2/`); GraphQL evolves the schema by adding fields and deprecating old ones.
- **Tooling:** GraphQL's schema enables code generation of type-safe Swift models (Apollo iOS codegen). REST can get similar benefits from OpenAPI generators (e.g. Apple's swift-openapi-generator).
- **Server complexity:** GraphQL needs protection against expensive nested queries and N+1 database problems; errors come back as HTTP 200 with an `errors` array, so the client must inspect the body.

REST is simpler and the industry default; GraphQL shines when many clients need different shapes of deeply related data.

---

### 7. What is a deadlock? Give an iOS-specific example. `Advanced`

**Short:** Two threads each wait for a resource the other holds. iOS: DispatchQueue.main.sync called from the main thread.

A deadlock occurs when two threads each hold a resource the other needs, so both wait forever. Classic iOS example: calling DispatchQueue.main.sync from the main thread — the main queue waits for the block, which can never start because main is blocked. libdispatch detects this particular case and traps (crashes) instead of hanging silently; the same applies to sync onto any serial queue you are already running on. Fix: use async, or restructure so no queue waits on itself.

```swift
// Crashes: dispatch_sync on a queue already owned by this thread
DispatchQueue.main.sync {
  print("never runs")
}
// Fix: use .async instead
```

---

### 8. What is the difference between concurrency and parallelism? `Advanced`

**Short:** Concurrency: structure for overlapping tasks. Parallelism: actually running tasks simultaneously on multiple cores.

Concurrency is about structure — designing a system to handle multiple tasks whose lifetimes overlap. Parallelism is about execution — actually running tasks at the same instant on multiple cores. You can have concurrency without parallelism (a single core time-slicing). Swift's async/await and actors express concurrent structure; the runtime's cooperative thread pool (about one thread per core) decides how much actually runs in parallel.

---

### 9. What is polymorphism? Give a Swift example. `Basic`

**Short:** Objects of different types treated uniformly through a shared interface. Runtime selects correct behavior.

Polymorphism ("many forms") lets you treat values of different concrete types through one shared interface, and the right implementation is selected for the actual type. Swift supports several kinds:

- **Subtype (inheritance) polymorphism:** a `UIView` variable can hold a `UILabel` or `UIButton`; overridden methods like `layoutSubviews()` are chosen at runtime through the class vtable.
- **Protocol polymorphism:** any type conforming to `Drawable` can be used through `any Drawable` (dynamic dispatch via a witness table) or `some Drawable` / generics (resolved at compile time).
- **Parametric polymorphism (generics):** one implementation works for many types — `Array<Element>`, `func max<T: Comparable>(...)`.
- **Ad-hoc polymorphism (overloading):** the same function name with different parameter types, chosen at compile time (`print(_ x: Int)` vs `print(_ x: String)`).

Benefits: calling code depends on behavior rather than concrete types, so new types can be added without changing callers (the Open/Closed principle), and tests can substitute fakes.

```swift
protocol Drawable { func draw() -> String }
struct Circle: Drawable { func draw() -> String { "○" } }
struct Square: Drawable { func draw() -> String { "□" } }

// Runtime (existential) polymorphism — heterogeneous array
let shapes: [any Drawable] = [Circle(), Square()]
shapes.forEach { print($0.draw()) }

// Compile-time (generic) polymorphism — specialized per type
func render<S: Drawable>(_ shape: S) -> String { shape.draw() }
```

---

### 10. What is the Foundation framework? `Basic`

**Short:** Base framework beyond the standard library: Data, URL, Date, FileManager, URLSession, JSON coding, formatters, ObjC bridging.

Foundation provides the building blocks above the Swift standard library. The standard library itself supplies the core types — `String`, `Array`, `Dictionary`, `Set`, `Int`, `Optional`, `Result`. Foundation adds what most apps need on top:

- **Data and values:** `Data`, `URL`, `Date`, `UUID`, `Decimal`, `Measurement`, `AttributedString`.
- **System services:** `FileManager`, `ProcessInfo`, `Bundle`, `UserDefaults`, `NotificationCenter`, `RunLoop`, `Timer`.
- **Networking:** `URLSession`, `URLRequest`, `URLCache`.
- **Coding and formatting:** `JSONEncoder`/`JSONDecoder`, `PropertyListEncoder`, `FormatStyle` (`date.formatted(...)`), `DateFormatter`, `NumberFormatter`.
- **Objective-C bridging:** `NSString`, `NSArray`, `NSNumber`, toll-free bridging with Core Foundation.

Most iOS apps get it implicitly through `import UIKit` or `import SwiftUI`. Apple has rewritten much of it in Swift as the open-source **swift-foundation** package, which `import Foundation` uses on Linux and Windows since Swift 6 and which is aligned with the macOS 15 / iOS 18 implementation — so the same high-performance `JSONDecoder`, `FormatStyle` and `Predicate` behave the same across platforms.

---

## Objective-C (8)

### 11. What is a category in Objective-C? How does it differ from a subclass? `Basic`

**Short:** Adds methods to an existing class without subclassing. No stored properties. Swift extension equivalent.

A **category** adds methods to an existing class — even one you don't have the source for, like `NSString` or `UIView` — without subclassing. The methods become part of the class itself, so every instance (including ones created by frameworks) gets them. Categories can also add protocol conformance and split a large class's implementation across files.

Limitations: a category **cannot add stored instance variables**; it can declare properties, but you must implement them yourself, typically with associated objects (`objc_setAssociatedObject`). If a category method has the same name as an existing method (or another category's), which one wins is undefined — so prefix category methods (`xyz_trimmed`). A **class extension** (`@interface MyClass ()`) is an anonymous category declared in the `.m` file; unlike a category it *can* add ivars and is used for private properties.

A **subclass** instead creates a new type: it can add stored properties and override methods (calling `super`), but only instances of the subclass get the behavior. Swift **extensions** are the direct equivalent of categories: they can add methods, computed properties, initializers and protocol conformances, but not stored properties.

```objc
@interface NSString (XYZTrimming)
- (NSString *)xyz_trimmed;
@end

@implementation NSString (XYZTrimming)
- (NSString *)xyz_trimmed {
  return [self stringByTrimmingCharactersInSet:
    NSCharacterSet.whitespaceAndNewlineCharacterSet];
}
@end
```

---

### 12. What are nil, Nil, NULL, and NSNull? `Intermediate`

**Short:** nil: ObjC object null. Nil: Class null. NULL: C pointer null. NSNull: object wrapping null for collections.

All four represent "nothing", but at different levels:

- **`nil`** — a null pointer to an Objective-C **object** (`id`, `NSString *`). Sending a message to `nil` is legal and does nothing, returning 0/`NO`/`nil` — a famous source of silent bugs.
- **`Nil`** — a null pointer to a **Class** (`Class cls = Nil;`), used e.g. when `NSClassFromString` finds no class.
- **`NULL`** — the C null pointer for non-object pointers (`void *`, `int *`, `CGContextRef`, `NSError **`).
- **`NSNull`** — a real singleton **object** (`[NSNull null]`) that represents null inside collections, because `NSArray` and `NSDictionary` cannot store `nil` (inserting `nil` crashes).

Where this matters in Swift: `JSONSerialization` turns JSON `null` into `NSNull`, so `dict["key"] as? String` returns `nil` for it — a reason to prefer `Codable`. Swift itself has only `nil`, which is `Optional.none`, and it works for every type, not just pointers.

```objc
id obj = nil;               // object pointer
Class cls = Nil;            // class pointer
void *ptr = NULL;           // C pointer
NSArray *a = @[[NSNull null], @"Hi"];   // null stored in a collection
[obj description];          // messaging nil: no crash, returns nil
```

---

### 13. What is a block in Objective-C? How do you avoid retain cycles? `Basic`

**Short:** Anonymous closure capturing variables from enclosing scope. Use __weak + __strong to prevent cycles.

A **block** is Objective-C's closure: an anonymous function that captures variables from its enclosing scope. Key behaviors:

- Captured local variables are copied **by value** at the moment the block is created; to let the block modify a local, declare it `__block`.
- Captured **objects are retained strongly**. If `self` owns the block (stores it in a property) and the block references `self` — or an ivar, which implicitly means `self->_ivar` — you get a retain cycle.
- Blocks start on the stack and must be **copied to the heap** to outlive the scope; ARC does this for you when you assign them to strong variables, which is why block properties are declared `copy`.

The fix is the **weak–strong dance**: capture a weak reference outside, then promote it to a strong local inside so `self` can't be deallocated halfway through the block; bail out if it is already gone. Swift's equivalent is `[weak self]` plus `guard let self else { return }`.

```objc
__weak typeof(self) weakSelf = self;
self.completion = ^{
  __strong typeof(weakSelf) strongSelf = weakSelf;
  if (!strongSelf) return;      // self was deallocated
  [strongSelf doSomething];     // safe for the whole block
};

__block NSInteger counter = 0;  // block may modify it
void (^inc)(void) = ^{ counter++; };
```

---

### 14. What are @synthesize and @dynamic? `Intermediate`

**Short:** @synthesize: auto-generates getter/setter (implicit since Xcode 4.4). @dynamic: runtime provides the impl (CoreData).

**`@synthesize`** tells the compiler to generate the getter, setter and backing instance variable for a `@property`. Since Xcode 4.4 (LLVM 4) this happens automatically, creating an ivar named `_property`, so you write it explicitly only when:

- you want a different ivar name (`@synthesize name = myName;`),
- you implement **both** the getter and setter yourself (or the getter of a `readonly` property) — auto-synthesis then stops, and you need `@synthesize` to get the ivar back,
- the property is declared in a **protocol** — properties from protocols are never auto-synthesized.

**`@dynamic`** promises the compiler that the accessors will exist at runtime, so it must not generate them and must not warn. Core Data's `NSManagedObject` subclasses use it because Core Data generates the accessors dynamically at runtime. It's also used when accessors are provided via `resolveInstanceMethod:` or by a superclass. If nothing provides them, calling the accessor crashes with "unrecognized selector".

The Swift equivalent of `@dynamic` for Core Data is `@NSManaged`.

```objc
@interface User : NSObject
@property (nonatomic, copy) NSString *name;
@end
@implementation User
@synthesize name = _userName;     // custom ivar name (rarely needed)
@end

@implementation Event            // NSManagedObject subclass
@dynamic timestamp;              // Core Data supplies accessors at runtime
@end
```

---

### 15. What is method swizzling? What are the risks? `Advanced`

**Short:** Exchanges method implementations at runtime. Risks: load-order dependent, recursion bugs, breaks Swift dispatch.

**Method swizzling** exchanges the implementations (IMPs) of two methods at runtime using `method_exchangeImplementations`, so calls to the original selector run your code. Your replacement then calls "itself", which — after the swap — actually invokes the original implementation. Typical uses: automatic analytics for every `viewDidAppear:`, debugging tools, and patching third-party or system bugs.

Doing it correctly:

- Swizzle in `+load` (or an explicit setup call) **once**, guarded by `dispatch_once`.
- Use `class_addMethod` first, so you don't accidentally swizzle a superclass's implementation when the subclass doesn't override the method.
- Always call the original implementation unless you mean to replace it.

Risks: global behavior changes that are hard to debug, order dependence when multiple libraries swizzle the same method, infinite recursion if the call is wired wrong, breaking when Apple changes private behavior, and it **only works with Objective-C dynamic dispatch** — pure Swift methods are statically or vtable dispatched, so they can only be swizzled if marked `@objc dynamic` (or via Swift's `@_dynamicReplacement`, which is meant for development tooling). Prefer subclassing, delegation, composition or a public hook.

```objc
@implementation UIViewController (Tracking)
+ (void)load {
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    Method original = class_getInstanceMethod(self, @selector(viewDidAppear:));
    Method swizzled = class_getInstanceMethod(self, @selector(trk_viewDidAppear:));
    method_exchangeImplementations(original, swizzled);
  });
}
- (void)trk_viewDidAppear:(BOOL)animated {
  [self trk_viewDidAppear:animated];   // calls the ORIGINAL after the swap
  NSLog(@"Appeared: %@", NSStringFromClass(self.class));
}
@end
```

---

### 16. Difference between strong, weak, assign, and copy properties. `Intermediate`

**Short:** strong: owns. weak: non-owning, auto-nils. assign: primitives only. copy: copies on assignment.

These attributes describe ownership and memory semantics of an Objective-C property:

- **`strong`** (default for objects): the property owns the object and keeps it alive (retain count +1).
- **`weak`**: no ownership; ARC sets it to `nil` automatically when the object is deallocated. Used for delegates, data sources, IBOutlets to subviews, and back-references to parents to avoid retain cycles.
- **`assign`**: a plain assignment with no memory management. Correct for primitives (`NSInteger`, `BOOL`, `CGFloat`, structs). Using `assign` for an object creates a **dangling pointer** after deallocation — accessing it crashes — which is why `weak` replaced it for objects. (`unsafe_unretained` is the explicit object version.)
- **`copy`**: stores a copy of the value. Essential for types with mutable subclasses — `NSString`, `NSArray`, `NSDictionary` — so a caller passing an `NSMutableString` can't change your property behind your back. Also used for **blocks**, historically to move them from the stack to the heap.

Related attributes: `atomic` (default — the accessor itself is thread-safe but the object is not; slower) vs `nonatomic` (almost always used on iOS), and `readonly`/`readwrite`. In Swift: `strong` = default reference, `weak` = `weak var`, `assign` for objects ≈ `unowned(unsafe)`, and `copy` = `@NSCopying`.

```objc
@property (nonatomic, strong) UIView *child;
@property (nonatomic, weak)   id<MyDelegate> delegate;
@property (nonatomic, assign) BOOL isLoading;
@property (nonatomic, copy)   NSString *title;          // protects against NSMutableString
@property (nonatomic, copy)   void (^onTap)(void);      // blocks are copied
```

---

### 17. What is the delegate pattern? When is it better than blocks? `Basic`

**Short:** Protocol-conforming object called back on events. Better for multiple lifecycle callback points.

A **delegate** is an object that conforms to a protocol and is called back by another object at specific moments, letting the delegating object stay generic while the owner customizes behavior. Examples: `UITableViewDelegate`, `UITextFieldDelegate`, `URLSessionDelegate`, `CLLocationManagerDelegate`. It's a one-to-one relationship, and the delegate property is `weak` to avoid retain cycles.

Delegates vs closures (blocks):

- **Delegates win** when there are **many related callbacks** across a lifecycle (a table view asks for heights, selection, editing…), when callbacks need to **return values** to the caller (`shouldChangeCharactersIn` → `Bool`), and when the protocol documents the contract in one place.
- **Closures win** for a **single, one-shot** callback (a completion handler) where capturing local context is convenient and defining a protocol would be boilerplate.

Alternatives today: `async/await` replaces most one-shot completion handlers, and Combine publishers, `AsyncStream` or `@Observable` models replace delegates whose job is just to report a stream of changes.

```swift
protocol ImagePickerDelegate: AnyObject {
  func picker(_ picker: ImagePicker, didPick image: UIImage)
  func pickerDidCancel(_ picker: ImagePicker)
}

final class ImagePicker {
  weak var delegate: ImagePickerDelegate?        // weak: avoid cycle
  func finish(with image: UIImage) { delegate?.picker(self, didPick: image) }
}
```

---

### 18. What is the Objective-C runtime? Name 3 things you can do with it. `Intermediate`

**Short:** Dynamic C library powering ObjC messaging. Inspect methods, add methods, associated objects, swizzle.

The Objective-C runtime (`objc/runtime.h`, `libobjc`) is the C library that makes Objective-C dynamic. Every method call is compiled to `objc_msgSend(receiver, selector, ...)`, which follows the object's `isa` pointer to its class, looks up the selector in a method cache and method lists (walking up superclasses), and jumps to the implementation (`IMP`). Because lookup happens at runtime, you can inspect and change classes while the app runs:

1. **Introspection:** `class_copyMethodList`, `class_copyPropertyList`, `respondsToSelector:`, `isKindOfClass:`, `NSClassFromString`.
2. **Adding behavior:** `class_addMethod`, or even creating whole classes with `objc_allocateClassPair`.
3. **Associated objects:** `objc_setAssociatedObject` / `objc_getAssociatedObject` to attach "stored properties" to existing classes from categories or Swift extensions.
4. **Method swizzling:** `method_exchangeImplementations`.
5. **Message forwarding:** when a method isn't found, the runtime calls `resolveInstanceMethod:`, then `forwardingTargetForSelector:`, then `forwardInvocation:` — the basis for proxies and mocking frameworks.

It also powers KVO (by dynamically subclassing the observed object, "isa-swizzling") and Core Data's `@dynamic` accessors. Swift classes that inherit from `NSObject` or use `@objc`/`dynamic` participate; pure Swift types don't.

```swift
import ObjectiveC

private var badgeKey: UInt8 = 0
extension UIView {
  var badgeText: String? {          // "stored" property via the runtime
    get { objc_getAssociatedObject(self, &badgeKey) as? String }
    set { objc_setAssociatedObject(self, &badgeKey, newValue, .OBJC_ASSOCIATION_COPY_NONATOMIC) }
  }
}
```

---

## Swift (13)

### 19. Struct vs Class — 3 key differences? `Basic`

**Short:** Value vs reference semantics. No inheritance for structs. Struct properties need var to mutate.

1. **Value vs reference semantics:** assigning or passing a struct copies the value (collections use copy-on-write, so copying is cheap until mutation). Assigning a class instance copies a **reference** — both variables point to the same object, so a change through one is visible through the other. Classes therefore have **identity** (`===`), structs don't.
2. **Inheritance:** only classes support inheritance, overriding and `super`; structs get polymorphism through protocols. Classes also have `deinit` and can be referenced weakly; structs can't.
3. **Mutability:** a struct declared with `let` is fully immutable, and methods that change it must be marked `mutating`. A class instance's `var` properties can be changed even through a `let` reference, because `let` only fixes the reference.

Other differences: structs get a free **memberwise initializer**; classes need designated/convenience initializers. Classes are always heap-allocated and reference-counted (ARC traffic); structs are often stored inline, are naturally thread-safe when copied, and are easier to make `Sendable`.

Apple's guidance: **use structs by default**; choose a class when you need identity or shared mutable state (a cache, a connection, a view model observed by several views), inheritance, Objective-C interop, or `deinit`.

```swift
struct Point { var x: Double }
var a = Point(x: 1)
var b = a          // copy
b.x = 99
print(a.x)         // 1.0 — unchanged

final class Node { var next: Node? }
let n = Node()
n.next = Node()    // OK: let fixes the reference, not the object
let m = n
print(m === n)     // true — same identity
```

---

### 20. What does @escaping mean on a closure parameter? `Basic`

**Short:** Closure outlives the function — stored or passed to async work. Non-escaping finishes within the function.

A closure parameter is **escaping** when it can be called **after the function returns** — because it's stored in a property, appended to an array, or handed to asynchronous work like `DispatchQueue.async` or a `URLSession` completion handler. Swift makes closure parameters **non-escaping by default**, and you must mark escaping ones with `@escaping`.

Why it matters:

- **Memory:** an escaping closure keeps everything it captures alive. If it captures `self` and `self` stores it, you get a retain cycle — so the compiler requires an explicit `self.` inside escaping closures in classes, nudging you to think about `[weak self]`.
- **Performance:** a non-escaping closure's context can live on the stack and be optimized away, with no heap allocation or reference counting.
- **Safety:** non-escaping closures are guaranteed to finish before the function returns, so they can safely capture `inout` parameters.

Notes: **optional** closure parameters (`(() -> Void)?`) are implicitly escaping. `withoutActuallyEscaping(_:do:)` lets you pass a non-escaping closure to an API that requires escaping when you know it won't escape. In modern code, `async` functions remove most completion-handler `@escaping` parameters.

```swift
final class Loader {
  private var handlers: [(Data) -> Void] = []

  func load(url: URL, completion: @escaping (Data) -> Void) {
    handlers.append(completion)                 // stored → escapes
    URLSession.shared.dataTask(with: url) { data, _, _ in
      if let data { completion(data) }          // called after load returns
    }.resume()
  }

  func transform(_ values: [Int], _ f: (Int) -> Int) -> [Int] {
    values.map(f)                               // non-escaping: runs now
  }
}
```

---

### 21. Difference between `some Protocol` and `any Protocol`? `Advanced`

**Short:** `some`: opaque, one fixed concrete type, static dispatch. `any`: existential container for any conforming type, dynamic dispatch.

`some Protocol` is an opaque type: the compiler knows the single concrete type behind it, enabling static dispatch and specialization — used for SwiftUI's body. `any Protocol` is an existential: a container that can hold any conforming type at runtime and dispatches through a witness table. Small values (up to 3 words) are stored inline in the container; larger ones are heap-allocated. Use `some` or generics by default; use `any` when you need heterogeneous values, such as an array of different shapes.

```swift
func makeView() -> some View { Text("Hi") }
let shapes: [any Shape] = [Circle(), Rectangle()]
```

---

### 22. What is a property wrapper? How does @State expand? `Intermediate`

**Short:** Struct with wrappedValue. Compiler expands @Foo var x into stored _x + computed x + projected $x.

A **property wrapper** is a type marked `@propertyWrapper` with a `wrappedValue` property. Applying it to a property moves the storage and get/set logic into the wrapper, so reusable behavior (clamping, trimming, UserDefaults storage, thread-safe access) is written once.

For `@Clamped var volume: Int`, the compiler generates:

- a private stored property **`_volume`** of the wrapper type,
- a computed property **`volume`** that forwards to `_volume.wrappedValue`,
- if the wrapper defines **`projectedValue`**, a computed **`$volume`** that returns it.

The wrapper's `init(wrappedValue:)` receives the initial value, so `@Clamped(range: 0...10) var volume = 5` works. Restrictions: wrappers apply to stored properties (and local variables/parameters), not to computed properties, and a wrapped property can't be `lazy`, `weak` or overridden.

**How `@State` expands:** `@State var count = 0` becomes `_count: State<Int>` plus `count` reading `_count.wrappedValue`. `State`'s storage isn't inside the struct — SwiftUI keeps it in its own graph, keyed by the view's identity, so it survives the view struct being recreated. Writing `wrappedValue` invalidates the views that read it. Its `projectedValue` is a `Binding<Int>`, which is why `$count` can be passed to a `Toggle` or child view. `@Published`, `@AppStorage`, `@Environment` and `@Binding` are all property wrappers too.

```swift
@propertyWrapper
struct Clamped<Value: Comparable> {
  private var value: Value
  let range: ClosedRange<Value>

  init(wrappedValue: Value, _ range: ClosedRange<Value>) {
    self.range = range
    self.value = min(max(range.lowerBound, wrappedValue), range.upperBound)
  }
  var wrappedValue: Value {
    get { value }
    set { value = min(max(range.lowerBound, newValue), range.upperBound) }
  }
  var projectedValue: ClosedRange<Value> { range }   // exposed as $name
}

struct Player {
  @Clamped(0...10) var volume = 15   // stored as _volume, clamped to 10
}
// Player().volume == 10, Player().$volume == 0...10
```

---

### 23. What is Sendable? Why does Swift 6 enforce it? `Advanced`

**Short:** Marker protocol: type safe to share across actor boundaries. Swift 6 turns data races into compile errors.

`Sendable` is a **marker protocol** (no requirements) that says a value can safely cross a concurrency boundary — be passed between actors or into a `Task` — without causing a data race. The compiler checks it:

- **Value types** (structs, enums) are implicitly `Sendable` when all their stored properties are `Sendable` (for non-public types).
- **Actors** are always `Sendable`, because they protect their own state.
- **Classes** must be `final` with only immutable (`let`) `Sendable` properties, or protect their state internally (with a lock) and opt out of checking with **`@unchecked Sendable`** — a promise you must keep yourself.
- **Closures** passed across boundaries must be `@Sendable` (capture only Sendable values, no mutable captures).

**Why Swift 6 enforces it:** in the **Swift 6 language mode**, complete concurrency checking is on and non-Sendable values crossing isolation boundaries are **compile errors** (in Swift 5 mode they're warnings at most). Data races become impossible to compile instead of rare runtime crashes. Later proposals reduce the friction: **region-based isolation** (SE-0414) lets you send a non-Sendable value that is no longer used afterwards, the **`sending`** keyword (SE-0430) marks such parameters and results, and the Synchronization framework's **`Mutex`** (iOS 18) makes lock-protected classes Sendable without `@unchecked`.

```swift
struct User: Sendable { var name: String }       // implicit for internal types

final class Config: Sendable {                    // immutable class
  let baseURL: URL
  init(baseURL: URL) { self.baseURL = baseURL }
}

final class Cache: @unchecked Sendable {          // you guarantee safety
  private let lock = NSLock()
  private var storage: [String: Data] = [:]
  func set(_ d: Data, for k: String) { lock.withLock { storage[k] = d } }
}
// final class Bad: Sendable { var count = 0 }   // error: mutable stored property
```

---

### 24. When do you prefer Result over throws? `Intermediate`

**Short:** Prefer Result for completion-handler callbacks where throws cannot propagate. Use throws in async/await.

`Result<Success, Failure: Error>` is an enum with `.success(value)` and `.failure(error)` — it turns "a value or an error" into a single value you can store and pass around. `throws` instead propagates the error up the call stack and forces callers to handle it with `try`.

Prefer **`Result`** when:

- you're delivering an outcome through a **completion handler** (pre-async code), where `throws` can't propagate out of the callback;
- you need to **store** the outcome — e.g. a cache of past attempts, or a ViewModel state;
- you want to **transform** it functionally with `map`, `flatMap`, `mapError`, or collect several outcomes (some succeeded, some failed) in an array;
- you're bridging to Combine (`Future`'s promise takes a `Result`).

Prefer **`throws`** for synchronous code and for `async` functions: it reads linearly, composes with `try`, `do/catch` and `rethrows`, and with typed throws (Swift 6) you can also fix the error type. Converting is easy: `Result { try parse(data) }` captures a throwing call, and `try result.get()` turns a Result back into throws. A continuation can also be resumed with a Result: `continuation.resume(with: result)`.

```swift
func fetch(completion: @escaping (Result<User, APIError>) -> Void) {
  completion(.success(user))
}

fetch { result in
  switch result {
  case .success(let u): show(u)
  case .failure(let e): showError(e)
  }
}

let parsed = Result { try JSONDecoder().decode(User.self, from: data) } // throws → Result
let user = try parsed.get()                                            // Result → throws
```

---

### 25. What are generics and why are they better than Any? `Intermediate`

**Short:** Type-safe parameterization checked at compile time; the optimizer can specialize them. No casting needed, unlike Any.

Generics parameterize types and functions while remaining fully type-safe. Unlike Any, which erases type information and needs runtime casts, generic code is type-checked at compile time with full inference. Unspecialized generic code calls protocol requirements through witness tables, but the optimizer usually specializes generics for the concrete types used, producing static dispatch and inlining. The standard library (Array, Dictionary, Optional) is built on generics.

```swift
func swap<T>(_ a: inout T, _ b: inout T) {
  let t = a; a = b; b = t
}
func find<T: Equatable>(in arr:[T],_ v:T) -> T? {
  arr.first { $0 == v }
}
```

---

### 26. Difference between throws and rethrows? `Intermediate`

**Short:** throws: function itself throws unconditionally. rethrows: only throws if a closure parameter it calls throws.

A function marked **`throws`** may throw on its own, so every call needs `try`. A function marked **`rethrows`** takes one or more throwing closure parameters and promises it will only throw **if one of those closures throws** — it never throws errors of its own.

The payoff is at the call site: the compiler looks at the closure you pass. A non-throwing closure makes the call non-throwing (no `try` needed); a throwing closure makes it throwing. That's how the standard library's `map`, `filter`, `compactMap`, `forEach`, `sorted(by:)` and `first(where:)` work with both kinds of closures from a single definition, without duplicate overloads.

Rules: a `rethrows` function can only throw inside a `catch` of an error coming from the closure (it may translate that error), it can't throw a fresh error unconditionally, and a `rethrows` function can't be passed a closure that's throwing for unrelated reasons. With Swift 6 **typed throws**, generic code can express the same idea more precisely: `func apply<E: Error>(_ f: () throws(E) -> Void) throws(E)` — non-throwing closures infer `E == Never`.

```swift
func apply<T>(_ value: T, _ transform: (T) throws -> T) rethrows -> T {
  try transform(value)            // throws only if transform throws
}

let doubled = apply(5) { $0 * 2 }                 // no try needed
let checked = try apply(5) { try validate($0) }   // try required
let n = [1, 2, 3].map { $0 * 2 }                  // map is rethrows
```

---

### 27. What determines static vs dynamic dispatch in Swift? `Intermediate`

**Short:** Structs, final/private members, extension-only methods: static. Overridable class methods: vtable. Protocol requirements: witness table.

Value types and final or private class members use static dispatch — direct, inlinable calls. Non-final class methods use vtable dispatch so overrides work. Protocol requirements called through a generic or existential use a witness table. Methods declared only in a protocol extension (not as requirements) are statically dispatched, so calling them through the protocol type ignores a conforming type's own version. @objc dynamic members use Objective-C message dispatch.

```swift
protocol Greeter {}
extension Greeter { func hi() { print("protocol") } }
struct En: Greeter { func hi() { print("En") } }
let g: any Greeter = En()
g.hi()      // "protocol" — hi() is not a requirement
En().hi()   // "En"
```

---

### 28. What is an Optional under the hood? `Basic`

**Short:** An enum with .none and .some(Wrapped). Unwrap with if let, guard let, ?? or optional chaining; ! only when nil is a bug.

`Optional<Wrapped>` is just a generic **enum** in the standard library with two cases: `.none` and `.some(Wrapped)`. `nil` is syntax for `.none` (via `ExpressibleByNilLiteral`), and `String?` is sugar for `Optional<String>`. Because it's an ordinary type, an optional `Int` is a different type from `Int` — you must unwrap before using the value, which is how Swift eliminates null-pointer crashes at compile time.

Ways to unwrap, safest first:

- **`if let` / `guard let`** (with the Swift 5.7 shorthand `if let name {}`), for conditional binding;
- **nil-coalescing** `value ?? default`;
- **optional chaining** `user?.address?.city` — the whole chain becomes optional and short-circuits at the first `nil`;
- **`switch` / `if case .some(let x)`** pattern matching;
- **`map` / `flatMap`** to transform the wrapped value without unwrapping;
- **force unwrap `!`** — crashes on `nil`; reserve it for cases where `nil` is a programmer error (e.g. a URL literal you control).

**Implicitly unwrapped optionals** (`String!`) are still `Optional` under the hood, with permission to unwrap automatically — mainly for IBOutlets and two-phase initialization. Memory note: for class references, `Optional` costs no extra space (`nil` is the null pointer); for other types an extra tag bit/byte may be needed.

```swift
let name: String? = nil
print(name ?? "Guest")                     // "Guest"

if let name { print(name.count) }          // Swift 5.7 shorthand
if case .some(let n) = name { print(n) }   // it's just an enum

let length = name.map { $0.count }         // Int?
let city = user?.address?.city             // String? — chaining
```

---

### 29. What does @autoclosure do? `Intermediate`

**Short:** Wraps an argument expression in a closure so it's evaluated lazily, only if needed. Used by ??, &&, assert.

`@autoclosure` turns an **argument expression** into a closure automatically. The caller writes a plain expression — `log(expensiveDescription())` — and the compiler wraps it as `{ expensiveDescription() }`. The function then decides **whether and when** to evaluate it, which gives you lazy evaluation without making callers write braces.

Where you see it in the standard library:

- `??` — the right-hand default is only evaluated when the left side is `nil`;
- `&&` and `||` — short-circuiting is implemented with autoclosures;
- `assert(_:_:)` and `precondition` — the condition and message aren't evaluated in builds where the check is disabled;
- `XCTAssertEqual` and friends.

It combines with `@escaping` (`@autoclosure @escaping`) if you store the closure for later. Use it sparingly in your own APIs: callers can't tell from the call site that their expression may never run or may run later, so side effects become surprising. Good uses are logging, assertions and lazily computed defaults.

```swift
func log(_ message: @autoclosure () -> String, enabled: Bool) {
  if enabled { print(message()) }
}
log(expensiveDescription(), enabled: false)  // never evaluated

// How ?? can be written:
func orDefault<T>(_ value: T?, _ fallback: @autoclosure () -> T) -> T {
  if let value { return value }
  return fallback()                           // only runs when needed
}
```

---

### 30. What are typed throws (Swift 6)? `Advanced`

**Short:** throws(MyError) declares the exact error type, so catch receives MyError instead of any Error.

Swift 6 (SE-0413) allows func f() throws(ParseError). A do/catch around it receives a ParseError without casting, and generic code can propagate an error type with throws(E). Plain throws means throws(any Error) and non-throwing is equivalent to throws(Never). The Swift team recommends untyped throws for most APIs because error sets tend to grow; typed throws suit closed error domains and performance-sensitive or embedded code.

```swift
enum ParseError: Error { case empty }
func parse(_ s: String) throws(ParseError) -> Int {
  guard !s.isEmpty else { throw .empty }
  return s.count
}
do { _ = try parse("") } catch { print(error) } // error is ParseError
```

---

### 31. Why can't you index a Swift String with an Int? `Intermediate`

**Short:** Characters are grapheme clusters of variable byte size, so nth-character access is O(n); String.Index makes that cost explicit.

A Character is an extended grapheme cluster — 'é' or a flag emoji may be several Unicode scalars and many bytes — so finding the nth character means walking from the start. Swift exposes String.Index instead of Int subscripts so the O(n) cost is visible. Use index(_:offsetBy:) or firstIndex(of:), or convert to Array(s) when an algorithm needs repeated random access. count is O(n) too.

```swift
let s = "café🇪🇬"
let i = s.index(s.startIndex, offsetBy: 3)
print(s[i])          // "é"
let chars = Array(s) // O(1) access afterwards
```

---

## UIKit (12)

### 32. UIViewController lifecycle in order? `Basic`

**Short:** loadView → viewDidLoad → viewWillAppear → viewIsAppearing → layout → viewDidAppear → viewWillDisappear → viewDidDisappear

Apple's documented order for a view controller appearing:

1. **`loadView()`** — creates `view`; override only when building the hierarchy in code (don't call `super` then).
2. **`viewDidLoad()`** — once per VC lifetime: one-time setup, constraints, data source wiring. Geometry isn't final yet.
3. **`viewWillAppear(_:)`** — before every appearance, before the view is added to the window. Use it for things that need the transition coordinator (alongside animations) or balanced register/unregister work.
4. The view is **added to the hierarchy, laid out by its superview, and trait collections are updated**.
5. **`viewIsAppearing(_:)`** — introduced with the iOS 17 SDK and **back-deployed to iOS 13**. Traits and geometry (size, safe area) are now accurate, and it runs in the same `CATransaction` as `viewWillAppear`, so changes appear together. Apple recommends it as the default place for appearance-time UI updates (e.g. scrolling to a selected cell).
6. **`viewWillLayoutSubviews()` / `viewDidLayoutSubviews()`** — after layout; frames are final, so set `CALayer` frames here. These can run **many times** (rotation, size changes), so keep them cheap and idempotent.
7. **`viewDidAppear(_:)`** — after the transition animation: start animations, analytics, timers.
8. **`viewWillDisappear(_:)` / `viewDidDisappear(_:)`** — pause work, save state, stop timers and observers.

Also know: `deinit` runs when the VC is released (a good leak check), `viewWillTransition(to:with:)` for size changes, and `traitCollectionDidChange` is deprecated since iOS 17 in favor of `registerForTraitChanges`. Always call `super` in the overrides.

```swift
override func viewDidLoad() {
  super.viewDidLoad(); setupUI()
}
override func viewDidLayoutSubviews() {
  super.viewDidLayoutSubviews()
  gradientLayer.frame = view.bounds
}
```

---

### 33. Difference between frame and bounds? `Basic`

**Short:** frame: rectangle in superview coordinates. bounds: rectangle in view's own coordinates, origin usually (0,0).

- **`frame`** is the view's rectangle in its **superview's** coordinate system: `frame.origin` is where the view sits inside its parent, `frame.size` how much space it occupies there. Use it to position a view.
- **`bounds`** is the same view's rectangle in its **own** coordinate system: origin is normally `(0, 0)`, size is the view's internal size. Use it for drawing and for laying out subviews inside the view.
- **`center`** is the view's center point in superview coordinates; with `bounds.size` it defines the frame.

Important details:

- Changing **`bounds.origin`** shifts the content: subviews appear to move the opposite way. That's exactly how `UIScrollView` scrolls — `contentOffset` *is* `bounds.origin`.
- With a non-identity **`transform`** (rotation, scale), `bounds` and `center` stay meaningful, but Apple documents `frame` as **undefined** and says to ignore it — in practice it reports the transformed bounding box. Position transformed views with `center` and size them with `bounds`.
- Convert between coordinate systems with `convert(_:to:)` / `convert(_:from:)` rather than doing the math yourself.

```swift
view.frame    // (50, 50, 100, 100) in the parent
view.bounds   // (0, 0, 100, 100) in its own space

view.transform = CGAffineTransform(rotationAngle: .pi / 4)
view.bounds   // still (0, 0, 100, 100)
view.center   // unchanged — use these, not frame

scrollView.bounds.origin.y == scrollView.contentOffset.y   // true

let pointInWindow = button.convert(button.bounds.origin, to: nil)
```

---

### 34. What is the responder chain? `Intermediate`

**Short:** Linked list of UIResponders. Touch delivered to deepest hit-tested view, propagates up if unhandled.

The **responder chain** is the linked list of `UIResponder` objects (views, view controllers, the window, the application) that UIKit walks to find someone to handle an event.

**Touches:** UIKit first runs **hit-testing** — `hitTest(_:with:)` recursively asks subviews, front to back, whether `point(inside:with:)` contains the touch; hidden views, views with `isUserInteractionEnabled = false`, and views with `alpha < 0.01` are skipped. The deepest view found becomes the **hit-test view** and receives the touch first (along with its gesture recognizers). If it doesn't handle it, the event travels up the chain: view → superview → … → the view controller's root view → **view controller** → (its parent VC) → **UIWindow** → **UIApplication** → **app delegate** (if it's a `UIResponder`).

**Other events** — keyboard input, motion, remote control, edit-menu actions — go to the **first responder** (the focused `UITextField`, for example) and then up the chain. `becomeFirstResponder()` / `resignFirstResponder()` move focus.

Practical uses: **nil-targeted actions** (`UIApplication.shared.sendAction(_:to: nil, from:for:)`) let a deep cell trigger an action implemented by whichever ancestor responds; overriding `point(inside:)` enlarges a tap area; overriding `hitTest` lets touches pass through an overlay. `next` returns the next responder, handy for finding a view's view controller.

```swift
// Expand a small button's tappable area by 20 pt on every side
final class LargeHitButton: UIButton {
  override func point(inside p: CGPoint, with e: UIEvent?) -> Bool {
    bounds.insetBy(dx: -20, dy: -20).contains(p)
  }
}

// Let touches pass through a transparent overlay except on its subviews
final class PassthroughView: UIView {
  override func hitTest(_ p: CGPoint, with e: UIEvent?) -> UIView? {
    let hit = super.hitTest(p, with: e)
    return hit === self ? nil : hit
  }
}
```

---

### 35. How does UITableView cell reuse work? What bugs can it cause? `Intermediate`

**Short:** Off-screen cells recycled via reuseIdentifier queue. Stale state bug: always fully configure in cellForRowAt.

A table view only creates enough cells to fill the screen plus a few extra. When a cell scrolls off-screen it goes into a **reuse queue** keyed by its reuse identifier; `dequeueReusableCell(withIdentifier:for:)` hands back one of those recycled cells (or creates a new one if the queue is empty). This keeps memory flat and scrolling fast even with 10,000 rows.

The catch: a dequeued cell **still has the state from the row it last displayed** — text, images, colors, checkmarks, hidden subviews, running animations. Typical bugs:

- **Stale content:** a row shows the previous row's checkmark because you only set `accessoryType` when it's selected, never reset it.
- **Wrong images (async race):** an image download started for row 3 finishes after the cell was reused for row 40 and overwrites it.
- **Duplicated subviews:** adding a subview in `cellForRowAt` instead of once in the cell's initializer.

Fixes: **configure every property on every pass** in `cellForRowAt` (set both branches of each `if`), cancel in-flight work and clear images in **`prepareForReuse()`** (it's for resetting, not configuring), and guard async callbacks by checking that the cell still represents the same item ID. Modern APIs make this harder to get wrong: cell registrations, `UIContentConfiguration` (`defaultContentConfiguration()`), and diffable data sources with stable item identifiers.

```swift
final class PhotoCell: UITableViewCell {
  private var imageTask: Task<Void, Never>?
  private(set) var itemID: UUID?

  func configure(with item: Item, loader: ImageLoader) {
    itemID = item.id
    textLabel?.text = item.title
    accessoryType = item.isDone ? .checkmark : .none   // always set both cases
    imageTask = Task { [weak self] in
      let image = try? await loader.image(for: item.url)
      guard let self, self.itemID == item.id else { return }  // still the same row?
      self.imageView?.image = image
    }
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    imageTask?.cancel()
    imageView?.image = nil
    textLabel?.text = nil
    accessoryType = .none
  }
}
```

---

### 36. What is intrinsicContentSize? `Intermediate`

**Short:** View's natural size based on content. Auto Layout uses it to set size without explicit constraints.

`intrinsicContentSize` is the **natural size a view wants based on its content**, independent of constraints: a `UILabel`'s size for its text and font, a `UIButton`'s size for its title and insets, a `UIImageView`'s image size, a `UISwitch`'s fixed size. A plain `UIView` returns `UIView.noIntrinsicMetric` for both dimensions.

Auto Layout turns the intrinsic size into implicit constraints, so you only need to position such views (leading/top) and they size themselves. Two priorities control what happens when constraints push against that size:

- **Content Hugging** (default `.defaultLow` = 250 for views created in code; IB uses 251 for labels): resistance to growing **larger** than intrinsic size. Higher hugging = "keep me tight".
- **Compression Resistance** (default `.defaultHigh` = 750): resistance to shrinking **smaller** than intrinsic size. Higher = "don't truncate me".

Classic example: two labels side by side in a row — give the title lower compression resistance than the price so the title truncates first, and give the price higher hugging so the title takes the extra space.

For a custom view, override `intrinsicContentSize` and call **`invalidateIntrinsicContentSize()`** whenever the content changes so Auto Layout re-asks. Multi-line labels need `preferredMaxLayoutWidth` (or a width constraint) to compute their height.

```swift
final class Badge: UIView {
  private let label = UILabel()
  var text = "" {
    didSet {
      label.text = text
      invalidateIntrinsicContentSize()     // tell Auto Layout to re-measure
    }
  }
  override var intrinsicContentSize: CGSize {
    let s = label.intrinsicContentSize
    return CGSize(width: s.width + 24, height: s.height + 12)
  }
}

priceLabel.setContentHuggingPriority(.required, for: .horizontal)
titleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
```

---

### 37. What is the run loop and how does it affect UIKit? `Advanced`

**Short:** Per-thread event loop. Heavy main-thread work starves it, causing dropped frames and hitches.

The run loop is a per-thread event loop that handles touches, timers and other input sources, then sleeps. UIKit's main run loop drives all UI: layout, drawing and event handling. Heavy synchronous work on the main thread starves it — no frames render and touches queue up, causing hitches and hangs. Move heavy work off the main actor (a nonisolated or @concurrent async function, or a background queue) and apply the result back on the main actor.

```swift
// Bad: heavy work blocks the main run loop
update(heavyProcess(bigList))
// Fix: run it off the main actor, update on main
Task {
  let result = await process(bigList) // @concurrent async func
  update(result)                      // back on the main actor
}
```

---

### 38. What is Auto Layout? What is a constraint priority? `Basic`

**Short:** Constraint-based layout solved by Cassowary algorithm. Priority 1-1000: 1000=required, lower ones break first.

Auto Layout describes layout as **constraints** — linear equations between view attributes, e.g. `button.leading = container.leading × 1.0 + 16` — instead of hard-coded frames. The engine (based on the **Cassowary** constraint-solving algorithm) solves all constraints together and produces frames that adapt to screen sizes, rotation, Dynamic Type and localization (right-to-left with leading/trailing).

Constraints must be:

- **Sufficient** — every view needs enough to determine x, y, width and height (intrinsic size can supply width/height). Otherwise layout is **ambiguous**.
- **Consistent** — if no solution satisfies all required constraints, they're **unsatisfiable**: UIKit logs "Unable to simultaneously satisfy constraints" and breaks one.

**Priority** is a value from 1 to 1000. 1000 (`.required`) must be satisfied; anything lower is **optional** — the engine satisfies it as closely as it can and drops lower priorities first when there's a conflict. Named values: `.required` (1000), `.defaultHigh` (750), `.defaultLow` (250), `.fittingSizeLevel` (50). A common pattern is an optional preferred size with a required maximum, so the layout degrades gracefully. Content hugging and compression resistance are priorities too.

Practical rules: set `translatesAutoresizingMaskIntoConstraints = false` on views you constrain in code, activate constraints in batches with `NSLayoutConstraint.activate`, prefer `UIStackView` for linear layouts, and debug with the view debugger or the `UIViewAlertForUnsatisfiedConstraints` symbolic breakpoint.

```swift
card.translatesAutoresizingMaskIntoConstraints = false
let preferredWidth = card.widthAnchor.constraint(equalToConstant: 400)
preferredWidth.priority = .defaultHigh          // optional: breaks first

NSLayoutConstraint.activate([
  card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
  card.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
  card.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, constant: -32), // required
  preferredWidth
])
```

---

### 39. When should you override drawRect(_:)? `Advanced`

**Short:** Only for custom Core Graphics drawing that CALayer cannot achieve. Creates large backing bitmap — expensive.

Override `draw(_:)` only when you need **custom Core Graphics drawing** that can't be expressed with existing views or layer properties — charts, audio waveforms, signature pads, custom progress rings with complex paths.

Why it's expensive:

- UIKit allocates a **backing bitmap** for the view's layer: width × height × scale² × 4 bytes. A full-screen view on a 3× iPhone is several megabytes.
- Drawing runs on the **CPU, on the main thread**, every time the view is invalidated with `setNeedsDisplay()`, so frequent redraws cause hitches.
- An empty `draw(_:)` override still forces the bitmap to be allocated — never leave one in the code.

Rules: never call `draw(_:)` yourself — call `setNeedsDisplay()` (or `setNeedsDisplay(_:)` for a sub-rect) and UIKit draws on the next update cycle; draw only within the `rect` you're given when possible; set `contentMode = .redraw` if the drawing depends on size.

Prefer cheaper alternatives: layer properties (`cornerRadius`, `borderWidth`, `shadowPath`), **`CAShapeLayer`** for paths (GPU-rendered and animatable via `strokeEnd`), `CAGradientLayer`, image assets or SF Symbols, or `UIGraphicsImageRenderer` to render once into an image and reuse it.

```swift
final class Ring: UIView {
  var progress: CGFloat = 0 { didSet { setNeedsDisplay() } }   // never call draw()

  override func draw(_ rect: CGRect) {
    let path = UIBezierPath(arcCenter: CGPoint(x: bounds.midX, y: bounds.midY),
                            radius: bounds.width / 2 - 4,
                            startAngle: -.pi / 2,
                            endAngle: -.pi / 2 + 2 * .pi * progress,
                            clockwise: true)
    path.lineWidth = 6
    UIColor.systemBlue.setStroke()
    path.stroke()
  }
}
// Cheaper: a CAShapeLayer with the full circle path, animating `strokeEnd`.
```

---

### 40. AppDelegate vs SceneDelegate? `Basic`

**Short:** AppDelegate: process-level events (launch, push registration). SceneDelegate (iOS 13+): each window's UI lifecycle.

Since iOS 13 an app's UI is organized into **scenes** — one per window, so on iPad (and in Stage Manager) an app can show several instances side by side. Responsibilities split in two:

- **`UIApplicationDelegate`** handles **process-level** events: `didFinishLaunchingWithOptions` (configure SDKs, services), push-notification registration and token callbacks, background URL session events, and choosing a scene configuration (`application(_:configurationForConnecting:options:)`). It also gets `didDiscardSceneSessions` when the user closes scenes.
- **`UIWindowSceneDelegate`** handles each **scene's UI lifecycle**: `scene(_:willConnectTo:options:)` (create the `UIWindow` and root view controller; handle deep links passed at launch), `sceneDidBecomeActive`, `sceneWillResignActive`, `sceneWillEnterForeground`, `sceneDidEnterBackground`, plus `scene(_:openURLContexts:)` and `scene(_:continue:)` for URLs and Universal Links while running.

Once an app adopts scenes, the app-level foreground/background callbacks (`applicationDidBecomeActive`, etc.) are **no longer called** — state that is per-window belongs in the scene delegate. SwiftUI hides this behind `App`, `WindowGroup` and `@Environment(\.scenePhase)`, with `@UIApplicationDelegateAdaptor` when you still need an app delegate.

Current status: since iOS 18.4 UIKit logs a warning for apps without the scene lifecycle, and Apple's TN3187 states that in the major release after iOS 26, apps built with the latest SDK **must adopt the scene-based lifecycle or they won't launch**. Supporting multiple windows stays optional — only adopting scenes is required.

```swift
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
             options: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene else { return }
    window = UIWindow(windowScene: windowScene)
    window?.rootViewController = RootViewController()
    window?.makeKeyAndVisible()
    if let url = options.urlContexts.first?.url { handleDeepLink(url) }
  }

  func sceneDidEnterBackground(_ scene: UIScene) { saveDraft() }
}
```

---

### 41. setNeedsLayout vs layoutIfNeeded? `Intermediate`

**Short:** setNeedsLayout: mark dirty, layout on the next update cycle. layoutIfNeeded: apply pending layout now — used to animate constraints.

UIKit batches layout work into an update cycle that runs once per run loop pass, so many changes cost one layout pass.

- **`setNeedsLayout()`** marks the view's layout as dirty and returns **immediately**. On the next update cycle UIKit calls `layoutSubviews()`. Calling it ten times still results in one layout pass — cheap and asynchronous.
- **`layoutIfNeeded()`** forces any **pending** layout to happen **right now**, synchronously, for that view and its subviews. If nothing is dirty, it does nothing.
- **`layoutSubviews()`** is where layout actually happens — override it in custom views to position subviews, but **never call it directly**.

The classic use of `layoutIfNeeded()` is **animating Auto Layout**: change the constraint's `constant` (which marks layout dirty), then call `layoutIfNeeded()` on the **common superview** inside an animation block, so the frame changes happen inside the animation. Call it once before the block too if other layout changes are pending, so they don't get animated by accident.

Siblings to know: `setNeedsUpdateConstraints()` / `updateConstraintsIfNeeded()` for the constraints pass, and `setNeedsDisplay()` for redrawing content via `draw(_:)`. Order in each cycle: update constraints → layout → display.

```swift
view.layoutIfNeeded()                    // flush pending layout first
heightConstraint.constant = expanded ? 300 : 120
UIView.animate(withDuration: 0.3) {
  self.view.layoutIfNeeded()             // frames change inside the animation
}
```

---

### 42. Why does a Timer stop firing while the user scrolls? `Advanced`

**Short:** Scheduled timers use the .default run loop mode; scrolling runs the main run loop in .tracking. Add the timer to .common.

A run loop only services input sources and timers registered for its **current mode**. `Timer.scheduledTimer(...)` adds the timer to the current run loop in **`.default`** mode. While the user drags a scroll view (and while it decelerates), UIKit switches the main run loop to **`.tracking`** mode (`UITrackingRunLoopMode`) so scrolling isn't disturbed — and timers registered only in `.default` don't fire until scrolling stops. A countdown label or carousel then appears to freeze.

Fixes:

- Create the timer unscheduled and add it with **`RunLoop.main.add(timer, forMode: .common)`** — `.common` is a pseudo-mode that includes both default and tracking.
- In Combine, use `Timer.publish(every:on: .main, in: .common)`.
- For per-frame visual updates, use **`CADisplayLink`** (added in `.common` mode), which syncs with the display refresh.
- In Swift concurrency, a `Task` loop with `try await Task.sleep(for:)` isn't tied to run loop modes.

Other timer facts worth mentioning: a scheduled `Timer` is **retained by the run loop** and the block-based API avoids the target retain cycle only if you capture `[weak self]`; call `invalidate()` when done; set `tolerance` (~10% of the interval) to let the system coalesce wakeups and save battery; timers aren't precise and don't fire while the app is suspended.

```swift
let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
  self?.tick()
}
timer.tolerance = 0.1
RunLoop.main.add(timer, forMode: .common)   // keeps firing during scrolling
// later: timer.invalidate()
```

---

### 43. What is a diffable data source? `Intermediate`

**Short:** Snapshot-based data source keyed by Hashable identifiers; apply() diffs and animates changes without index-path bookkeeping.

UITableViewDiffableDataSource and UICollectionViewDiffableDataSource replace manual numberOfRows and performBatchUpdates. You build an NSDiffableDataSourceSnapshot of section and item identifiers and apply it; UIKit computes the diff and animates inserts, deletes and moves, eliminating 'invalid number of rows' crashes. Identifiers must be unique and stable — use model IDs rather than whole models — and call reconfigureItems (iOS 15) to refresh existing cells.

```swift
var snap = NSDiffableDataSourceSnapshot<Section, Item.ID>()
snap.appendSections([.main])
snap.appendItems(items.map(\.id))
dataSource.apply(snap, animatingDifferences: true)
```

---

## SwiftUI (17)

### 44. Difference between @State and @Binding? `Basic`

**Short:** @State: view owns the storage. @Binding: two-way reference to state owned elsewhere.

- **`@State`** declares a **source of truth owned by the view**. SwiftUI stores the value outside the view struct (in its attribute graph, tied to the view's identity), so it survives the struct being recreated on every body evaluation, and writing it re-renders the views that read it. Mark it `private` — it should be initialized and changed by the view itself. Use it for local UI state: is a sheet shown, text field contents, selected tab. Since iOS 17 it also owns `@Observable` model objects.
- **`@Binding`** is a **two-way reference** to a value owned somewhere else. It stores no data — just a getter and setter pointing at the source of truth. A child receives it with the `$` prefix (`Child(isOn: $isOn)`), can read and write it, and the owner updates.

Rule of thumb: the view that **creates and owns** the data uses `@State`; a view that **needs to modify** data it doesn't own uses `@Binding`; a view that only **reads** it takes a plain `let`. You can derive bindings to sub-properties (`$user.name`), and for previews or fixed values use `.constant(true)`. Don't use `@State` for data passed in from a parent — it only uses the initial value (see Q57).

```swift
struct Parent: View {
  @State private var isOn = false           // owns the truth
  var body: some View {
    VStack {
      Toggle("Switch", isOn: $isOn)
      Child(isOn: $isOn)                    // passes a binding
      Label(text: isOn ? "On" : "Off")      // read-only: plain value
    }
  }
}
struct Child: View {
  @Binding var isOn: Bool                   // can read and write
  var body: some View { Button("Flip") { isOn.toggle() } }
}
#Preview { Child(isOn: .constant(true)) }
```

---

### 45. Difference between @StateObject and @ObservedObject? `Intermediate`

**Short:** @StateObject: view creates and owns it (stable lifetime). @ObservedObject: passed from outside, may change.

Both observe an `ObservableObject` and re-render the view when its `objectWillChange` publisher fires (e.g. a `@Published` property changes). The difference is **ownership and lifetime**:

- **`@StateObject`** — the view **creates and owns** the object. SwiftUI creates it **once** for the lifetime of the view's identity (the initializer is an autoclosure, evaluated only the first time) and keeps it alive while the view is in the hierarchy, even though the view struct is recreated many times.
- **`@ObservedObject`** — the view **receives** an object owned elsewhere. SwiftUI doesn't manage its lifetime; it just subscribes to it.

The classic bug: `@ObservedObject var vm = HomeVM()` in a child view. Every time the parent's `body` runs, the child struct is recreated, a **new** `HomeVM` is created, and state is lost (loading spinners restart, network requests repeat). Fix: `@StateObject` at the creation site, `@ObservedObject` (or `@EnvironmentObject`) further down.

Note that `@StateObject` only reads its initial argument once — passing a different id later won't create a new object; change the view's `.id()` to force that. For iOS 17+ with `@Observable`, the equivalents are `@State` (owned) and a plain property / `@Bindable` (received).

```swift
struct Root: View {
  @StateObject private var vm = HomeVM()   // created once, owned here
  var body: some View { HomeView(vm: vm) }
}

struct HomeView: View {
  @ObservedObject var vm: HomeVM           // passed in, not owned
  var body: some View { Text(vm.title) }
}
// ❌ @ObservedObject var vm = HomeVM()   — recreated on every parent update
```

---

### 46. What is @Observable (iOS 17) vs ObservableObject? `Intermediate`

**Short:** @Observable: property-level tracking per view. ObservableObject: whole-object @Published fires on any change.

The **Observation** framework's `@Observable` macro (iOS 17+) replaces `ObservableObject` for most code:

- **Granularity:** with `ObservableObject`, *any* `@Published` change fires `objectWillChange`, and **every** view observing the object re-evaluates its body — even views that never read the changed property. `@Observable` tracks which properties each view's `body` **actually reads** during rendering, and invalidates only those views when those properties change.
- **Less boilerplate:** all stored properties are observable by default — no `@Published`. Opt a property out with `@ObservationIgnored`.
- **Simpler property wrappers:** owned instances use `@State` (not `@StateObject`), received ones are plain `let`/`var` properties, `@Bindable` creates bindings, and shared ones go through `.environment(model)` and `@Environment(Model.self)`.
- **Works beyond direct properties:** tracking follows reads through arrays, nested observable objects and computed properties.

Things to watch: it only works on **classes**; `@Observable` objects are not Combine publishers, so code relying on `$property.sink` needs `withObservationTracking` or (iOS 26) the `Observations` async sequence; and `@State var model = Model()` runs the initializer on each view init (cheap objects only).

UIKit also supports it: on **iOS 26**, reading `@Observable` properties inside `updateProperties()`, `layoutSubviews()`, `viewWillLayoutSubviews()` or a cell's `configurationUpdateHandler` registers automatic observation, and UIKit re-runs the method when those properties change — no manual `setNeedsLayout`.

```swift
@Observable final class ProfileModel {
  var name = ""                      // tracked per property, no @Published
  var avatarURL: URL?
  @ObservationIgnored var cache: [String: Data] = [:]
}

struct ProfileView: View {
  @State private var model = ProfileModel()   // owner uses @State
  var body: some View {
    Text(model.name)    // only re-renders when `name` changes, not avatarURL
  }
}
```

---

### 47. What is view identity in SwiftUI? `Advanced`

**Short:** Determines if SwiftUI updates or recreates a view. Structural: position in hierarchy. Explicit: .id() or Identifiable.

SwiftUI views are value-type descriptions that are recreated constantly; **identity** is how SwiftUI knows that "this `Text` now" is the same element as "that `Text` before". Identity determines **lifetime**: as long as identity stays the same, SwiftUI updates the existing view and keeps its `@State`, focus, scroll position and animations; when identity changes, the old view is destroyed (state reset, `onDisappear`) and a new one is created (`onAppear`, transitions).

Two kinds:

- **Structural identity** — the view's type and position in the view tree. The two branches of an `if/else` are different positions, so toggling the condition replaces one view with the other (and resets its state). Prefer a modifier with a conditional value (`.opacity(isOn ? 1 : 0)`) when you want the *same* view to change rather than be swapped.
- **Explicit identity** — given by `ForEach` IDs (`Identifiable.id` or `id: \.someKey`) and by `.id(value)`. Changing `.id(...)` deliberately **resets** a view — useful to restart a form or scroll position, harmful when done by accident.

Pitfalls: IDs must be **stable and unique** (no `UUID()` generated in `body`, no array indices for mutable lists), and `AnyView` erases type information, weakening structural identity and diffing.

```swift
if isOn { Text("A") } else { Text("B") }   // two identities: state resets
Text(isOn ? "A" : "B")                     // one identity: just updates

ForEach(items) { item in Row(item: item) } // identity = item.id (stable)
DetailView(user: user).id(user.id)         // new user → fresh state
```

---

### 48. What causes unnecessary SwiftUI redraws? `Advanced`

**Short:** ObservableObject fires on any @Published change, AnyView, unstable identity, inline object creation in body.

A SwiftUI view's `body` re-evaluates when something it depends on changes. Re-evaluation is usually cheap, but unnecessary or heavy evaluations cause hitches in lists and animations. Common causes:

1. **Broad `ObservableObject` publishing** — every `@Published` change invalidates every view observing the object, even if it reads a different property. Fix: adopt `@Observable` (property-level tracking) or split the object.
2. **Passing large models** to children that need one field — the child's inputs "change" whenever the model does. Pass the specific values instead.
3. **Inputs that are never equal** — closures, freshly created objects, formatters or `UUID()`/`Date()` created inside `body` make the child's inputs differ on every pass, so SwiftUI can't skip it.
4. **`AnyView`** — erases types, so SwiftUI can't diff structurally and may rebuild subtrees.
5. **Unstable identity** — `ForEach` over indices or random IDs causes views to be recreated instead of updated.
6. **State placed too high** — a frequently changing value (a timer, scroll offset, text field) stored at the root re-evaluates the whole screen. Move it into the smallest subview that needs it.
7. **Heavy work in `body`** — sorting, filtering, date formatting. Precompute in the model.

Diagnose with `Self._printChanges()` and the SwiftUI template in Instruments (see Q154).

```swift
// ❌ Redraws when ANY published property of BigVM changes
struct Bad: View {
  @ObservedObject var vm: BigVM
  var body: some View { Text(vm.title) }
}

// ✅ Only depends on what it shows
struct Good: View {
  let title: String
  var body: some View { Text(title) }
}

// ✅ Keep fast-changing state local to a small view
struct Clock: View {
  @State private var now = Date.now
  var body: some View {
    Text(now, style: .time)
      .task { while !Task.isCancelled { try? await Task.sleep(for: .seconds(1)); now = .now } }
  }
}
```

---

### 49. What is ViewBuilder? `Intermediate`

**Short:** Result builder transforming multiple View expressions in a closure into TupleView. Enables SwiftUI's DSL.

`@ViewBuilder` is a **result builder** (`@resultBuilder`) specialized for views. Inside a builder closure, every expression statement is collected and combined by static `build...` methods into a single return value, which is how you can list several views without commas or a `return`:

- multiple views → `buildBlock` → a `TupleView<(A, B, C)>`;
- `if` without `else` → `buildIf` → an optional view;
- `if/else` and `switch` → `buildEither` → `_ConditionalContent<A, B>` (both branches' types are preserved, which keeps structural identity);
- `if #available` → `buildLimitedAvailability`.

`body` is implicitly `@ViewBuilder`, as are the content closures of `VStack`, `HStack`, `Group` and so on. Apply it yourself to: custom container initializers that take content, functions or computed properties that return different views in different branches, and `@ViewBuilder` closure properties.

Limits: builders don't support `for` loops with side effects or `let` mutation — use `ForEach`. The old **10-child limit** came from `buildBlock` overloads; since Swift 5.9 builders use parameter packs, so newer SDKs accept more children, but grouping related views is still better for readability.

```swift
struct Card<Content: View>: View {
  private let content: Content
  init(@ViewBuilder content: () -> Content) { self.content = content() }
  var body: some View {
    content
      .padding()
      .background(.background, in: .rect(cornerRadius: 12))
  }
}

@ViewBuilder
func statusView(for state: LoadState) -> some View {
  switch state {
  case .loading: ProgressView()
  case .loaded(let items): List(items) { Text($0.name) }
  case .failed: Label("Failed", systemImage: "exclamationmark.triangle")
  }
}
```

---

### 50. What is @EnvironmentObject? `Basic`

**Short:** Object injected by ancestor into the environment, readable anywhere below without threading through views.

`@EnvironmentObject` reads an `ObservableObject` that an **ancestor injected** into the environment with `.environmentObject(_:)`. Every descendant can read it without the object being passed through each intermediate view's initializer (avoiding "prop drilling"), and views that read it re-render when it publishes changes.

Good fits: genuinely app-wide or flow-wide state — the auth session, user settings, a theme, a navigation router, a cart.

Downsides:

- **Runtime crash** if no ancestor provided the object ("No ObservableObject of type X found") — previews and sheets are common places to forget it (in older iOS versions, sheets didn't inherit environment objects).
- **Hidden dependency** — the initializer doesn't show that the view needs it, which makes reuse and testing harder.
- Lookup is **by type**, so you can only have one object per type in a subtree.
- Same coarse invalidation as any `ObservableObject`.

For iOS 17+ with `@Observable`, use `.environment(model)` to inject and `@Environment(Model.self) var model` to read (crashes the same way if missing; use `@Environment(Model.self) var model: Model?` for an optional lookup). For simple values (colors, feature flags), define a custom `EnvironmentKey` — with the `@Entry` macro on newer SDKs — instead.

```swift
@main struct MyApp: App {
  @StateObject private var auth = AuthManager()
  var body: some Scene {
    WindowGroup { ContentView().environmentObject(auth) }
  }
}

struct ProfileView: View {
  @EnvironmentObject var auth: AuthManager    // no initializer parameter needed
  var body: some View { Text(auth.userName) }
}
#Preview { ProfileView().environmentObject(AuthManager.preview) }  // or it crashes
```

---

### 51. What is PreferenceKey? Give a real use case. `Advanced`

**Short:** Lets child views bubble data UP to ancestors. Used for measuring sizes, syncing widths, sticky headers.

`PreferenceKey` sends data **up** the view tree — from children to an ancestor — which is the opposite direction of `@Environment`. A child attaches a value with `.preference(key:value:)`; SwiftUI collects values from all children using the key's **`reduce(value:nextValue:)`** (e.g. take the max, append to an array), and an ancestor reads the combined result with **`.onPreferenceChange(_:perform:)`**, or uses it during layout with `overlayPreferenceValue` / `backgroundPreferenceValue`. SwiftUI uses this mechanism itself for `navigationTitle` and `toolbar`, where a deep child configures a container above it.

Real uses:

- **Measuring** a child's rendered size (inside a `GeometryReader` in its background) and reporting it upward — e.g. sizing a sheet to its content.
- **Equal widths:** labels in a form report their widths, the parent takes the max and applies it to all.
- **Scroll tracking:** report a child's frame in a named coordinate space to drive a collapsing header.
- **Anchors:** `anchorPreference` reports bounds so the parent can draw a selection indicator or tooltip over a specific child.

On newer SDKs, `onGeometryChange(for:of:action:)` (back-deployed to iOS 16) is simpler for measuring a single view, and `onScrollGeometryChange` (iOS 18) for scroll offsets.

```swift
struct MaxWidthKey: PreferenceKey {
  static let defaultValue: CGFloat = 0
  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
    value = max(value, nextValue())
  }
}

struct Form: View {
  @State private var labelWidth: CGFloat = 0
  var body: some View {
    VStack(alignment: .leading) {
      ForEach(["Name", "Email address"], id: \.self) { title in
        Text(title)
          .background(GeometryReader { proxy in
            Color.clear.preference(key: MaxWidthKey.self, value: proxy.size.width)
          })
          .frame(width: labelWidth > 0 ? labelWidth : nil, alignment: .leading)
      }
    }
    .onPreferenceChange(MaxWidthKey.self) { labelWidth = $0 }
  }
}
```

---

### 52. What is @Bindable? `Intermediate`

**Short:** Creates bindings to properties of an @Observable object you don't own; can also be declared as a local var inside body.

With `ObservableObject`, `@ObservedObject var vm` gave you `$vm.name` bindings automatically. With `@Observable` models a received model is just a plain property, which can't produce bindings — that's what **`@Bindable`** (iOS 17+) adds: a property wrapper whose `$` projection creates `Binding`s to the model's properties.

When you need it:

- A view **receives** an `@Observable` model and must **edit** it with controls that need a `Binding` (`TextField`, `Toggle`, `Picker`, `NavigationStack(path:)`).
- A model comes from **`@Environment(Model.self)`** — declare a local `@Bindable var model = model` inside `body` to get `$model.property`.
- Inside a `ForEach` over observable objects: `ForEach(items) { item in @Bindable var item = item; ... }`.

When you don't: an owner already holding the model in `@State` can use `$model.name` directly, and views that only **read** the model need no wrapper at all — observation tracking works through a plain property. `@Bindable` doesn't own or retain extra state; it's a thin binding factory.

```swift
@Observable final class Profile { var name = ""; var isPublic = false }

struct Editor: View {
  @Bindable var profile: Profile                     // received, editable
  var body: some View {
    Form {
      TextField("Name", text: $profile.name)
      Toggle("Public", isOn: $profile.isPublic)
    }
  }
}

struct RootView: View {
  @Environment(Router.self) private var router
  var body: some View {
    @Bindable var router = router                    // local @Bindable
    NavigationStack(path: $router.path) { HomeView() }
  }
}
```

---

### 53. .task vs .onAppear { Task { } }? `Intermediate`

**Short:** .task starts when the view appears and is cancelled automatically when it disappears; .task(id:) restarts on id change.

.task ties the async work's lifetime to the view: it starts before the view appears and is cancelled when the view disappears. .task(id:) also cancels and restarts the work whenever the id changes — ideal for loading details for a selection. .onAppear { Task { } } creates an unstructured task that keeps running after the view disappears unless you store and cancel it yourself. Cancellation is cooperative, so the work must not swallow CancellationError.

```swift
.task(id: selectedID) {
  await model.loadDetail(for: selectedID) // previous load cancelled
}
```

---

### 54. How does SwiftUI layout work, and why does modifier order matter? `Intermediate`

**Short:** Parent proposes a size, child chooses its own, parent places it. Each modifier wraps the view, so order changes the result.

Layout is a negotiation: the parent proposes a size, the child picks its own size (it may ignore the proposal), and the parent positions the child. Text respects the proposed width by wrapping or truncating; shapes fill what they're offered. Each modifier wraps the view in a new view, so .padding().background(.yellow) colors the padded area while .background(.yellow).padding() colors only behind the text.

```swift
Text("Hi").padding().background(.yellow) // yellow includes padding
Text("Hi").background(.yellow).padding() // yellow only behind text
```

---

### 55. What's the problem with GeometryReader, and what are the alternatives? `Intermediate`

**Short:** It takes all offered space and pins children top-leading. Prefer containerRelativeFrame, ViewThatFits, or a custom Layout.

`GeometryReader` gives its content a `GeometryProxy` (size, safe-area insets, frames in coordinate spaces), but it has awkward layout behavior:

- It's **greedy**: it accepts the entire proposed size, so inside a `VStack` or `ScrollView` it grabs all available space (or collapses to a default height in a scroll view) and pushes siblings around.
- It places its content at the **top-leading** corner instead of centering it.
- Reading geometry and writing it back into `@State` can cause **extra layout passes** or even update loops.

Using it inside `.background { GeometryReader { ... } }` or `.overlay` avoids the sizing problem, because a background takes the size of the view it's attached to.

Modern alternatives:

- **`containerRelativeFrame`** (iOS 17) — size a view as a fraction of the nearest container (scroll view, navigation stack, window), e.g. carousel cards at 80% of the width.
- **`ViewThatFits`** (iOS 16) — choose the first child layout that fits (horizontal buttons, falling back to vertical).
- **`Layout` protocol** (iOS 16) — custom `sizeThatFits` / `placeSubviews` logic for flow layouts, radial layouts, equal-width rows.
- **`onGeometryChange(for:of:action:)`** — read a single value (size, frame) of a view without wrapping it, back-deployed to iOS 16.
- **`visualEffect`** (iOS 17) and scroll transitions — geometry-driven effects without state round-trips.

```swift
ScrollView(.horizontal) {
  LazyHStack {
    ForEach(cards) { card in
      CardView(card: card)
        .containerRelativeFrame(.horizontal) { width, _ in width * 0.8 }
    }
  }
}

ViewThatFits {
  HStack { primaryButton; secondaryButton }   // try side by side
  VStack { primaryButton; secondaryButton }   // fall back to stacked
}

Text(title)
  .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { titleHeight = $0 }
```

---

### 56. How does value-based navigation with NavigationStack work? `Intermediate`

**Short:** Bind a path ([Route] or NavigationPath), push Hashable values, and map them to views with one navigationDestination per stack.

NavigationStack(path:) takes a binding to an array of Hashable route values (or a type-erased NavigationPath for mixed types); NavigationLink(value:) or path.append pushes, removing elements pops. Register navigationDestination(for:) once on the stack's content, not on each row — rows in lazy lists may not exist yet. A route enum must be Hashable, so every associated value must be Hashable too. Prefer a typed [Route] over NavigationPath, and give each tab its own path.

```swift
enum Route: Hashable { case detail(Place.ID), settings }
@State private var path: [Route] = []
NavigationStack(path: $path) {
  List(places) { p in NavigationLink(p.name, value: Route.detail(p.id)) }
    .navigationDestination(for: Route.self) { route in destination(route) }
}
```

---

### 57. Why is @State wrong for data passed in from a parent? `Basic`

**Short:** @State's initial value is used only once per view identity; later values from the parent are ignored.

@State storage is created once when the view first appears and then owned by SwiftUI, so a value passed in through the initializer is only used the first time — later updates from the parent are silently ignored. Use a plain let for read-only input, @Binding for two-way editing, or the @Observable model itself. Related: with @State var model = Model(), the initializer expression runs on every init of the view struct (the extra instances are discarded), so keep it cheap.

```swift
struct Detail: View {
  let place: Place             // ✅ follows parent updates
  // @State var place: Place   // ❌ keeps the first value only
  var body: some View { Text(place.name) }
}
```

---

### 58. Why is ForEach(0..<items.count) dangerous? `Advanced`

**Short:** Identity becomes the index, so after inserts or deletes per-row state attaches to the wrong item and animations break.

ForEach identifies rows by their IDs. With indices as IDs, deleting item 0 makes the old row 1 become row 0, so SwiftUI keeps row 0's state (toggles, text drafts, focus) and applies it to a different item; animations also misfire. Use Identifiable models with stable ids. For editable rows, ForEach($items) { $item in ... } gives a binding per element while keeping identity stable.

```swift
ForEach(0..<items.count, id: \.self) { i in Row(item: items[i]) } // ❌
ForEach($items) { $item in Toggle(item.name, isOn: $item.done) }  // ✅
```

---

### 59. Animation vs transition in SwiftUI? `Intermediate`

**Short:** .animation / withAnimation animate property changes of a view that stays. .transition animates insertion and removal.

withAnimation { } or .animation(_:value:) interpolates changes to properties of views that remain in the hierarchy — position, color, scale. A transition describes how a view enters or leaves, so it only runs when the view is inserted or removed (an identity change, e.g. inside an if), and it needs the state change to happen inside an animation. iOS 17 lets you build reusable custom transitions with the Transition protocol.

```swift
if showDetail {
  DetailView().transition(.move(edge: .bottom))
}
Button("Toggle") { withAnimation { showDetail.toggle() } }
```

---

### 60. How do you make a SwiftUI view accessible? `Intermediate`

**Short:** Combine related elements, give custom controls labels and traits, support Dynamic Type with @ScaledMetric, hide decoration.

Group related content with .accessibilityElement(children: .combine) so VoiceOver reads one element. Controls built from shapes plus onTapGesture get no traits — prefer Button or Toggle, or add a label, value and traits (.isToggle exists since iOS 17). Support Dynamic Type: use text styles, @ScaledMetric (iOS 14) for custom sizes, and avoid fixed heights that clip text. Hide decorative images, keep 44×44 pt targets, and test with VoiceOver and Xcode's accessibility audit (performAccessibilityAudit in UI tests).

```swift
HStack { Image(systemName: "star.fill"); Text(place.name) }
  .accessibilityElement(children: .combine)
@ScaledMetric(relativeTo: .body) var iconSize = 24.0
Image(decorative: "divider")
```

---

## Protocols & POP (8)

### 61. Why is Swift called a 'protocol-oriented' language? `Basic`

**Short:** Swift encourages designing via protocols and protocol extensions rather than class inheritance.

Apple introduced "protocol-oriented programming" at WWDC 2015 ("Protocol-Oriented Programming in Swift"). The idea: start a design from **protocols** (what a type can do) rather than from a **base class** (what a type is), and share behavior through **protocol extensions** instead of inheritance.

What makes Swift suited to it:

- **Value types participate fully** — structs and enums can conform to protocols, so you get polymorphism without classes, reference semantics or shared mutable state.
- **Protocol extensions** provide default implementations, so conformers get behavior for free (like a base class) while still being able to customize it.
- **Retroactive modeling** — you can make existing types, including standard-library and Apple types, conform to your protocols with an extension.
- **Composition** — a type conforms to many small protocols (`Codable & Hashable & Identifiable`), avoiding deep inheritance trees and the "fragile base class" problem.
- **Generics and constraints** — `where` clauses, associated types and conditional conformance let algorithms be written once against protocols; the standard library itself (`Sequence`, `Collection`) is built this way.

Benefits for apps: loose coupling, easy test doubles (conform a mock to the protocol), and reusable behavior across unrelated types. Swift is still multi-paradigm — classes are the right tool for identity and UIKit — so "protocol-oriented" is a default design approach, not a rule.

```swift
protocol Identifiable2 { var id: String { get } }
protocol Describable { var summary: String { get } }

extension Describable where Self: Identifiable2 {       // shared default behavior
  var summary: String { "Item \(id)" }
}

struct Product: Identifiable2, Describable { let id: String }   // struct, no base class
print(Product(id: "42").summary)                                 // "Item 42"
```

---

### 62. What is Protocol Composition in Swift? `Basic`

**Short:** Combining multiple protocols into one requirement using &. e.g., Codable & Equatable.

**Protocol composition** combines several protocols into one type requirement with `&`: `Encodable & Equatable` means "a type that conforms to both". It doesn't create a new protocol; it's an anonymous intersection you can use anywhere a type is expected:

- generic constraints: `func save<T: Codable & Identifiable>(_ item: T)`,
- existentials: `let item: any Codable & Hashable`,
- opaque types: `some View & Equatable`,
- type aliases: `typealias Codable = Encodable & Decodable` — the standard library defines `Codable` exactly this way.

It can also include **one class type**, which requires the value to be that class (or subclass) *and* conform: `UIViewController & Refreshable` is a view controller that can refresh — handy for coordinators and child-VC containers.

Why use it instead of a new combined protocol: it keeps protocols small (Interface Segregation), lets each API ask for exactly the capabilities it needs, and avoids inventing protocol names like `CodableHashableIdentifiable`. Create a named protocol instead when the combination has its own meaning or adds requirements.

```swift
func isSame<T: Encodable & Equatable>(_ a: T, _ b: T) -> Bool { a == b }

typealias Persistable = Codable & Identifiable

protocol Refreshable { func refresh() }
func refreshAll(_ screens: [UIViewController & Refreshable]) {
  screens.forEach { $0.refresh() }       // class + protocol
}
```

---

### 63. What is an associatedtype in a protocol? `Intermediate`

**Short:** A placeholder type in a protocol that conforming types define concretely. Enables generic protocols.

An `associatedtype` is a **placeholder type** inside a protocol; each conforming type decides what it concretely is. It makes protocols generic: `Sequence` has `associatedtype Element`, so `[Int]` is a sequence of `Int` and `String` a sequence of `Character`. Conforming types can state the type with a `typealias`, but usually the compiler **infers** it from method signatures.

You can constrain associated types (`associatedtype Item: Codable`) and use them in `where` clauses (`extension Container where Item: Equatable`).

Using such a protocol as a type:

- Historically, a protocol with associated types (PAT) **couldn't be used as a plain type** ("can only be used as a generic constraint"), so you wrote generics or type-erasers like `AnyPublisher`/`AnySequence`.
- Swift 5.7 introduced **`any Container`** existentials for these protocols, and **primary associated types** — `protocol Container<Item>` — which allow lightweight constraints: `some Collection<Int>`, `any Collection<String>`. This removes many hand-written type erasers.

Generic constraints (`<C: Container>` or `some Container`) are still preferred when performance matters, because the compiler knows the concrete type.

```swift
protocol Container<Item> {               // Item is a primary associated type
  associatedtype Item
  mutating func add(_ item: Item)
  func item(at i: Int) -> Item
}

struct Box<T>: Container {               // Item inferred as T
  private var items: [T] = []
  mutating func add(_ item: T) { items.append(item) }
  func item(at i: Int) -> T { items[i] }
}

func firstOf(_ c: some Container<String>) -> String { c.item(at: 0) }
let anyBox: any Container<Int> = Box<Int>()
```

---

### 64. What is conditional conformance? `Intermediate`

**Short:** A generic type conforms to a protocol only when its type parameter meets certain conditions.

**Conditional conformance** (Swift 4.1, SE-0143) lets a generic type conform to a protocol **only when its type parameters meet requirements**. It's written as an extension with a `where` clause.

Standard-library examples:

- `Array: Equatable where Element: Equatable` — `[1, 2] == [1, 2]` works, but arrays of non-Equatable types can't be compared.
- `Optional: Hashable where Wrapped: Hashable`, `Dictionary: Codable where Key: Codable, Value: Codable`.
- `Array: Codable where Element: Codable` — which is why decoding `[User].self` just works.

Why it matters: before it existed, the library needed separate types or runtime checks; now generic wrappers compose naturally — a `Result<User, MyError>` is `Equatable` if both parameters are, an `Array<Array<Int>>` is `Hashable`, and your own `Box<T>` can be `Codable` exactly when `T` is.

Limitations: a type can conform to a given protocol only **once** — you can't have two different conditional conformances to the same protocol with different conditions. The compiler can also **synthesize** `Equatable`, `Hashable` and `Codable` in a conditional extension.

```swift
struct Box<T> { var value: T }
extension Box: Equatable where T: Equatable {}   // == synthesized only when T: Equatable
extension Box: Codable where T: Codable {}

Box(value: 1) == Box(value: 1)                    // ✅ Int is Equatable
// Box(value: UIView()) == Box(value: UIView())  // ❌ no conformance
```

---

### 65. Explain Equatable, Hashable, and Comparable. `Basic`

**Short:** Equatable: ==. Hashable: hash value for Set/Dictionary (requires Equatable). Comparable: ordering with <.

- **`Equatable`** — defines `==` (and `!=` for free). Value equality, not identity.
- **`Hashable`** — refines `Equatable` and adds `hash(into:)`, which feeds the significant properties into a `Hasher`. Required for `Set` elements and `Dictionary` keys, and for SwiftUI `ForEach(id:)` and diffable data sources.
- **`Comparable`** — refines `Equatable` and adds `<`; you get `>`, `<=`, `>=`, `min`, `max` and `sorted()` for free.

Why `Hashable` inherits `Equatable`: hash-based collections first jump to a bucket using the hash, then confirm with `==`. The rule is **if `a == b`, then `a.hashValue == b.hashValue`** (equal values must hash equally; unequal values may collide). Hash the **same properties** you compare in `==` — hashing a property you don't compare breaks this rule.

Synthesis: the compiler writes these for you when all stored properties conform — `Equatable` and `Hashable` for structs and enums, and `Comparable` for enums without associated values (cases compare in declaration order, Swift 5.3). Note that hash values are **randomly seeded per process launch**, so never persist `hashValue` or use it as a stable ID.

```swift
struct Version: Hashable, Comparable {
  let major: Int, minor: Int
  static func < (a: Version, b: Version) -> Bool {
    (a.major, a.minor) < (b.major, b.minor)          // tuple comparison
  }
}

enum Priority: Comparable { case low, medium, high }  // synthesized: low < high

let latest = [Version(major: 1, minor: 2), Version(major: 2, minor: 0)].max()
var seen: Set<Version> = []                            // needs Hashable
```

---

### 66. What is the Codable protocol? `Basic`

**Short:** Type alias for Encodable & Decodable. Compiler synthesizes encode/decode for qualifying types.

`Codable` is a type alias for `Encodable & Decodable`. When all stored properties are themselves `Codable` (String, Int, Date, URL, arrays, dictionaries, optionals, nested Codable types), the compiler **synthesizes** `encode(to:)` and `init(from:)` and a private `CodingKeys` enum. Encoders/decoders for a format (`JSONEncoder`/`JSONDecoder`, `PropertyListEncoder`) walk those keys.

Customizing:

- **Rename keys** with a `CodingKeys` enum (`case firstName = "first_name"`), or set `decoder.keyDecodingStrategy = .convertFromSnakeCase`. Properties left out of `CodingKeys` are skipped (they need a default value).
- **Dates and data:** `dateDecodingStrategy` (`.iso8601`, `.secondsSince1970`, `.formatted`, `.custom`), `dataDecodingStrategy`.
- **Custom logic:** implement `init(from:)` to handle missing keys (`decodeIfPresent`), default values, polymorphic payloads, or flattening nested JSON with `nestedContainer`.
- **Optionals:** a missing key or `null` decodes to `nil` for optional properties; for non-optional properties it throws.

Errors are typed `DecodingError` cases (`keyNotFound`, `typeMismatch`, `valueNotFound`, `dataCorrupted`) with a `codingPath` — log them, they pinpoint the bad field. Reuse one configured decoder rather than creating one per request.

```swift
struct User: Codable {
  let id: Int
  let firstName: String
  let joined: Date
  var isAdmin = false

  enum CodingKeys: String, CodingKey { case id, firstName = "first_name", joined }  // isAdmin not decoded
}

let decoder = JSONDecoder()
decoder.dateDecodingStrategy = .iso8601
do {
  let user = try decoder.decode(User.self, from: json)
} catch let DecodingError.keyNotFound(key, ctx) {
  print("Missing \(key.stringValue) at \(ctx.codingPath)")
}
```

---

### 67. How do you create optional protocol methods in Swift? `Intermediate`

**Short:** Protocol extension with default no-op implementation (preferred, works with structs). Or @objc optional (classes only).

Swift protocols have no `optional` keyword for pure-Swift code — every requirement must be implemented. Two ways to get the effect:

1. **Default implementation in a protocol extension** (preferred). Declare the method in the protocol and give it an empty (or sensible) body in an extension; conformers override it only if they care. Works with structs, enums and classes, stays type-safe, and calls dispatch dynamically to the conformer's version **because the method is a protocol requirement**. Be careful: if a method is only in the extension and not declared in the protocol, calls through the protocol type will always use the default (static dispatch — see Q27).
2. **`@objc optional`** — mark the protocol `@objc` and the method `@objc optional`. Only classes (Objective-C compatible) can conform, parameter types must be representable in Objective-C, and callers must use optional chaining (`delegate?.didFail?()`) because the method might not exist. This is how UIKit's delegate protocols work.

A third design option is to **split the protocol** into a required one and an optional one (Interface Segregation), or use closures for optional callbacks.

```swift
protocol PlayerDelegate: AnyObject {
  func didFinish()        // required
  func didPause()         // "optional" via default below
}
extension PlayerDelegate {
  func didPause() {}      // default no-op
}

@objc protocol LegacyDelegate {
  @objc optional func didFail(_ error: NSError)
}
// call site: delegate?.didFail?(error)
```

---

### 68. How does protocol conformance compare to class inheritance for performance? `Advanced`

**Short:** Generics/some: can be specialized to static dispatch (fastest). Existentials (any P): container plus witness-table dispatch (slowest).

Non-final class methods use vtable dispatch; protocol requirements called through a generic or existential use witness-table dispatch — similar cost. Generic code constrained to a protocol can be specialized by the optimizer into static dispatch with inlining, the fastest option. Existentials (any Protocol) add an existential container (inline buffer for values up to 3 words, a heap box beyond that), dynamic dispatch, and they block specialization. Prefer `some P` or `<T: P>` over `any P` in hot paths.

---

## Memory & ARC (12)

### 69. How does ARC work? `Basic`

**Short:** Compiler inserts retain/release calls. Object deallocates immediately when strong reference count reaches zero.

**Automatic Reference Counting** manages the memory of class instances (and closures, actors). The **compiler** inserts `retain` (increment) and `release` (decrement) operations at compile time wherever references are created, copied or go away; there is no background collector.

How it works:

- Each heap object keeps a **strong reference count**. Assigning an instance to a `var`, `let`, property, collection or closure capture creates a strong reference (+1); when that reference is overwritten or goes out of scope, it's released (−1).
- When the strong count reaches **zero**, `deinit` runs immediately and memory is freed — deterministic, unlike garbage collection.
- **`weak`** references don't keep the object alive and become `nil` when it's deallocated (Swift implements them via a side table); **`unowned`** references don't keep it alive either but are non-optional.
- The optimizer removes many redundant retain/release pairs, but reference counting operations are atomic and have real cost in hot loops.

What ARC **doesn't** do: break **reference cycles** (two objects holding each other strongly never reach zero — you must use `weak`/`unowned`), and it doesn't manage value types directly (structs are copied, but references *inside* them are counted), or C memory (`malloc`, Core Foundation objects from functions not annotated — though most CF APIs are bridged automatically).

```swift
class Person {
  let name: String
  init(name: String) { self.name = name }
  deinit { print("\(name) freed") }
}

var a: Person? = Person(name: "Ahmed")   // count 1
var b = a                                // count 2
a = nil                                  // count 1
b = nil                                  // count 0 → "Ahmed freed" immediately
```

---

### 70. Difference between strong, weak, and unowned references? `Basic`

**Short:** Strong: owns (ARC++). Weak: no ownership, auto-nil on dealloc. Unowned: no ownership, non-Optional, crashes if nil.

- **`strong`** (the default): keeps the object alive; the referenced object can't be deallocated while this reference exists.
- **`weak`**: doesn't increase the strong count. When the object is deallocated, the reference automatically becomes `nil`, so it must be an **optional `var`**. Accessing it is always safe — you just might get `nil`.
- **`unowned`**: doesn't increase the strong count and is **non-optional** — you're asserting the referenced object will always outlive this reference. Accessing it after the object is deallocated **crashes** deterministically (Swift checks this). `unowned(unsafe)` skips the check — faster, but a dangling pointer like Objective-C's `assign`.

When to use which:

- `weak` for **delegates**, data sources, parent back-references, and closures that might outlive `self` (`[weak self]`) — whenever lifetimes are independent.
- `unowned` when the lifetimes are **tied** and the other object is guaranteed to live at least as long: a `CreditCard` that can't exist without its `Customer`, or a closure stored by `self` that only runs while `self` exists.
- When unsure, use `weak` — a `nil` check is cheaper than a crash.

Both `weak` and `unowned` can only apply to class (reference) types, and protocols used with them must be class-constrained (`AnyObject`). Since Swift 5, `unowned` can also be optional (`unowned var x: T?`).

```swift
protocol Delegate: AnyObject {}
final class VC { weak var delegate: Delegate? }   // independent lifetime

final class Customer { var card: CreditCard? }
final class CreditCard {
  unowned let owner: Customer                      // card never outlives owner
  init(owner: Customer) { self.owner = owner }
}
```

---

### 71. What is a retain cycle? Give an example. `Intermediate`

**Short:** Two objects strongly reference each other — neither count reaches zero. Memory leaks permanently.

A **retain cycle** (strong reference cycle) happens when objects reference each other strongly, directly or through a chain, so none of their reference counts can ever reach zero. Even after your code drops every outside reference, they keep each other alive — a **memory leak** that also keeps their observers, timers and network callbacks running.

Common shapes in iOS code:

1. **Two objects** holding strong properties to each other (parent ↔ child, VC ↔ its custom view that stores the VC).
2. **Closures** stored by `self` that capture `self` strongly — completion handlers, `lazy var` closures, Combine `sink`, `Timer` blocks, NotificationCenter block observers (Q72, Q77, Q78).
3. **Delegates** declared `strong` instead of `weak`.
4. **Timers** — a repeating `Timer` with `target: self` is retained by the run loop and retains its target until invalidated.
5. **Doubly linked structures** (Q79) and child-to-parent coordinator references.

Fix: decide which side **owns** the other and make the back-reference `weak` (or `unowned` when lifetimes are tied), use capture lists in closures, and invalidate/cancel long-lived callbacks. Detect: add `deinit` logging, use the **Memory Graph Debugger**, the **Leaks** instrument, or a weak-reference unit test (Q80).

```swift
final class Parent {
  var child: Child?
  deinit { print("Parent freed") }
}
final class Child {
  weak var parent: Parent?     // weak breaks the cycle
  deinit { print("Child freed") }
}

var p: Parent? = Parent()
p?.child = Child()
p?.child?.parent = p
p = nil                        // both deinit messages print
```

---

### 72. How do retain cycles form in closures? `Intermediate`

**Short:** Closure captures self strongly by default inside a class. If self owns the closure, both keep each other alive.

Closures are reference types that **capture** the variables they use. In a class, using `self` (explicitly, or implicitly by touching a property or method) captures `self` **strongly** by default. If `self` also stores that closure — in a property, an array of handlers, a Combine subscription, a timer it owns — then `self → closure → self` is a cycle and neither is freed.

Fix with a **capture list**:

- **`[weak self]`** — `self` becomes optional inside the closure. Use `guard let self else { return }` (Swift 5.7 shorthand) to get a strong reference for the rest of the body, so `self` can't disappear halfway through. Safe whenever `self` might be deallocated before the closure runs.
- **`[unowned self]`** — non-optional, no unwrapping, but crashes if `self` is gone when the closure runs. Use only when the closure can't outlive `self`.
- **Capture what you need instead of `self`**: `[api, id] in api.load(id)` captures those values, not the whole object.

Capture lists are evaluated when the closure is **created**, not when it runs. Also remember a cycle needs ownership: non-escaping closures and short one-shot async closures don't create leaks (Q77).

```swift
final class SearchVM {
  var onResults: (([String]) -> Void)?
  private let api = API()

  func setup() {
    onResults = { [weak self] results in      // self stores this closure
      guard let self else { return }
      self.render(results)
    }
  }

  func search(_ q: String) {
    api.search(q) { [api] _ in _ = api }      // capture a dependency, not self
  }
}
```

---

### 73. What is Copy-on-Write (CoW)? How do you implement it for a custom type? `Intermediate`

**Short:** Shared buffer until mutation. isKnownUniquelyReferenced checks before copying to avoid unnecessary copies.

**Copy-on-write** makes value types with large storage cheap to copy. A CoW type is a struct that wraps a **reference** to a heap buffer. Copying the struct just copies the reference (and retains it), so both copies share the buffer. Only when one copy is **mutated** while the buffer is shared does it make a real copy first. The result: value semantics (copies are independent) with reference-like performance for reads and passing around.

`Array`, `Dictionary`, `Set` and `String` all use CoW. That's why passing an array to a function or assigning it is O(1), and why the **first mutation** after a copy can be O(n).

Implementing it yourself:

1. Put the data in a private `final class Storage`.
2. Expose it through a struct.
3. In every **mutating** path, call `isKnownUniquelyReferenced(&storage)`; if it returns `false`, replace `storage` with a copy before writing.

Note that **custom structs don't get CoW automatically** — a struct holding a few `Int`s is just copied (which is cheap). CoW only applies to types that implement it, and a struct holding a class reference without CoW logic would share mutations — breaking value semantics. Also keep the uniqueness check thread-safe by mutating only through `mutating` methods on `var`s.

```swift
struct Buffer {
  private final class Storage {
    var values: [Int]
    init(_ values: [Int]) { self.values = values }
  }
  private var storage = Storage([])

  var values: [Int] { storage.values }

  mutating func append(_ v: Int) {
    if !isKnownUniquelyReferenced(&storage) {   // shared? copy first
      storage = Storage(storage.values)
    }
    storage.values.append(v)
  }
}

var a = Buffer(); a.append(1)
var b = a          // shares storage
b.append(2)        // copies now; a.values == [1], b.values == [1, 2]
```

---

### 74. Difference between ARC and garbage collection? `Advanced`

**Short:** ARC: deterministic, compiler-inserted retain/release, immediate dealloc, no cycle detection. GC: runtime tracing, handles cycles.

ARC is deterministic — an object is freed as soon as its last strong reference goes away, at compiler-inserted release points. It has no collector pauses, but it is not free: every retain and release is an atomic operation with real runtime cost (the optimizer removes many of them), and ARC cannot reclaim reference cycles. Garbage collection (Java, Go) periodically finds unreachable objects at runtime — it handles cycles automatically but adds memory overhead and less predictable pauses. ARC's predictability suits latency-sensitive mobile apps.

---

### 75. How do you debug memory leaks in iOS? `Advanced`

**Short:** Instruments: Leaks instrument with allocation backtraces. Memory Graph Debugger for visual reference cycles.

1. **Notice it:** memory growth in Xcode's Debug Navigator gauge when repeating an action (open/close a screen 5 times), or a missing `deinit` log. Adding `deinit { print("\(Self.self) freed") }` to view controllers and view models in debug builds is the cheapest early warning.
2. **Memory Graph Debugger** (Debug Memory Graph button in the debug bar): pauses the app and shows every live object and the references keeping it alive. Leaked objects are flagged with a purple "!", and filtering by your type name shows instances that should be gone. Enable **Malloc Stack Logging** (Scheme → Diagnostics, "Live allocations only") to see the allocation backtrace for each object.
3. **Instruments → Leaks**: detects unreachable cycles over time with backtraces. Combine with the **Allocations** instrument and **Mark Generation** to find growth that isn't a true leak (e.g. an unbounded cache, abandoned memory).
4. **Fix the reference**: usually a closure capturing `self` stored by `self`, a strong delegate, an un-invalidated `Timer`, a NotificationCenter block observer, a Combine `sink` without `[weak self]`, or a parent ↔ child strong pair.
5. **Prevent regressions** with a weak-reference unit test (Q80).

Also useful: the `leaks` and `heap` command-line tools on a memory graph file (`.memgraph`), which can be exported and attached to bug reports or run in CI.

---

### 76. What is an autorelease pool? Is it still relevant in Swift? `Advanced`

**Short:** Defers release of autoreleased ObjC objects until the pool drains. Still useful in loops calling ObjC APIs, to cap peak memory.

An autorelease pool collects objects that received autorelease and releases them when the pool drains — on the main thread, once per run loop iteration. Pure Swift code rarely autoreleases, but many Objective-C, Foundation and UIKit APIs still return autoreleased objects. In a tight loop calling such APIs (loading images, processing files) those temporaries pile up until the outer pool drains, spiking peak memory. Wrapping each iteration in autoreleasepool { } frees them every iteration.

```swift
for path in imagePaths {
  autoreleasepool {
    let image = UIImage(contentsOfFile: path)
    process(image)
  } // ObjC temporaries freed each iteration
}
```

---

### 77. When is [weak self] NOT needed? `Intermediate`

**Short:** Non-escaping closures and short-lived async work that self doesn't store (DispatchQueue.async, a finishing Task) only delay deallocation.

A cycle requires self to own, directly or indirectly, the closure that captures it. Non-escaping closures like map or forEach can't create one. DispatchQueue.main.async { self... } or UIView.animate keep self alive only until the block runs — a delay, not a leak. A Task that captures self and finishes is fine too. You do need [weak self] or explicit cancellation for closures self stores: long-running Tasks (an endless for await loop) held by self, Timer blocks, NotificationCenter block observers, and Combine sinks stored in self's cancellables.

---

### 78. Can a lazy var cause a retain cycle? `Intermediate`

**Short:** Yes, if it stores a closure capturing self. A lazy var initialized by calling a closure once is fine.

A lazy property whose value is a closure capturing self creates a cycle: self stores the closure and the closure retains self. Use [weak self] or [unowned self] in that closure. By contrast, a lazy var initialized by an immediately-invoked closure — { ... }() — runs once and discards the closure, so only the resulting value is stored and there is no cycle.

```swift
class VM {
  var name = ""
  func save() {}
  lazy var onTap: () -> Void = { self.save() }                 // cycle
  lazy var safeTap: () -> Void = { [weak self] in self?.save() }
  lazy var title: String = { self.name.uppercased() }()        // fine
}
```

---

### 79. In a doubly linked list (e.g. an LRU cache), why must prev be weak? `Advanced`

**Short:** Adjacent nodes referencing each other strongly form cycles; when the list is dropped, the nodes never deallocate.

In a doubly linked list each node points to both neighbors. If **both** `next` and `prev` are strong, every pair of adjacent nodes references each other strongly — node A owns B through `next`, B owns A through `prev` — so the list is a chain of two-object retain cycles. When the cache drops its `head` and `tail` references (or the cache itself is deallocated), no node's strong count reaches zero, and **every node and every cached value leaks**.

Fixes:

- Make **`prev` weak** — ownership flows one way (head → tail through `next`), and back-pointers don't own. This is the idiomatic answer.
- Use `unowned(unsafe)` for `prev` in performance-critical code where the list guarantees a node's predecessor outlives it — it avoids weak-reference overhead but crashes or corrupts memory if that guarantee is broken.
- Or keep both strong and **explicitly unlink** every node (`prev = nil; next = nil`) in `removeAll()` and `deinit` — easy to forget.

An LRU cache is a common interview exercise: a dictionary for O(1) lookup plus a doubly linked list for O(1) "move to front" and eviction. Add a deinit-based leak test (Q80) to prove the list releases its nodes. Note also that a very long list freed from the head deallocates recursively, which can overflow the stack — iterative unlinking avoids that.

```swift
final class Node<Key, Value> {
  let key: Key
  var value: Value
  var next: Node?          // owns the next node
  weak var prev: Node?     // back-pointer: doesn't own
  init(key: Key, value: Value) { self.key = key; self.value = value }
}
```

---

### 80. How can a unit test verify that an object is deallocated? `Intermediate`

**Short:** Keep only a weak reference, let the strong one go out of scope, then assert the weak reference is nil.

The idea: keep **only a weak reference** to the object under test outside the scope where it's created. When the scope ends and the code is leak-free, the last strong reference disappears, ARC deallocates the object immediately, and the weak reference becomes `nil`. If a retain cycle (closure capturing `self`, strong delegate, stored Combine subscription, timer) keeps it alive, the weak reference is still non-`nil` and the assertion fails.

Tips:

- Exercise the code paths that could create the cycle (call `start()`, trigger the closure, subscribe) before the scope ends.
- If cleanup depends on async work finishing (a `Task` that holds `self` until it completes), await or cancel that work first, otherwise you'll get false failures.
- In XCTest you can make this reusable: a `trackForMemoryLeaks(_:)` helper that registers `addTeardownBlock { [weak instance] in XCTAssertNil(instance) }`, so every test that creates a view model also checks it's released.
- These tests are cheap and run on every CI build, catching leaks long before Instruments would.

```swift
@Test func downloaderIsReleased() {
  weak var weakRef: Downloader?
  do {
    let downloader = Downloader()
    downloader.start()              // exercise the code that could leak
    weakRef = downloader
  }                                 // last strong reference gone
  #expect(weakRef == nil)
}

// XCTest helper
extension XCTestCase {
  func trackForMemoryLeaks(_ instance: AnyObject, file: StaticString = #filePath, line: UInt = #line) {
    addTeardownBlock { [weak instance] in
      XCTAssertNil(instance, "Potential memory leak", file: file, line: line)
    }
  }
}
```

---

## Concurrency (17)

### 81. What is GCD and its Quality of Service (QoS)? `Basic`

**Short:** GCD manages thread pools automatically. QoS: userInteractive > userInitiated > default > utility > background.

**Grand Central Dispatch** (libdispatch) is Apple's C-level concurrency library. Instead of creating and managing threads, you submit **work items** (closures) to **queues**, and GCD runs them on a system-managed thread pool sized to the hardware. Key pieces: the **main queue** (serial, runs on the main thread — all UI work), **global concurrent queues** per QoS, **custom serial/concurrent queues**, plus `DispatchGroup`, `DispatchSemaphore`, `DispatchWorkItem` (cancellable), `asyncAfter`, and dispatch sources (timers, file events).

**Quality of Service** tells the system how important the work is, which affects CPU scheduling priority, I/O priority and energy (efficiency cores, timer coalescing). From highest to lowest:

- **`.userInteractive`** — must finish within a frame: animations, event handling, main thread work.
- **`.userInitiated`** — the user started it and is waiting: opening a document, loading a tapped item.
- **`.default`** — between the two; the fallback when none is specified.
- **`.utility`** — long-running with visible progress, user not blocked: downloads, imports.
- **`.background`** — invisible maintenance: backups, prefetching, indexing; may be heavily throttled (e.g. in Low Power Mode).

Wrong QoS is a real performance bug: background-QoS work that the UI then waits on causes delays (and priority inversion). Swift concurrency uses the same idea via `TaskPriority` (`.userInitiated`, `.utility`, `.background`, etc.).

```swift
DispatchQueue.global(qos: .userInitiated).async {
  let result = heavyComputation()
  DispatchQueue.main.async { self.update(result) }   // UI back on main
}

let work = DispatchWorkItem { prefetchImages() }
DispatchQueue.global(qos: .background).asyncAfter(deadline: .now() + 2, execute: work)
work.cancel()   // cancels only if it hasn't started
```

---

### 82. Difference between serial and concurrent queues? `Basic`

**Short:** Serial: one task at a time in FIFO order. Concurrent: multiple tasks can run simultaneously.

- **Serial queue:** runs one work item at a time, in FIFO order; the next starts only when the previous finishes. Items may run on different threads, but never simultaneously. The **main queue** is serial. Custom queues are serial by default: `DispatchQueue(label:)`.
- **Concurrent queue:** **starts** items in FIFO order, but may run many at once, as threads are available, and they can finish in any order. The global queues are concurrent; create your own with `attributes: .concurrent`.

Uses:

- A **serial queue as a lock**: route every read and write of some shared state through it — no data races because only one closure touches the state at a time.
- A **concurrent queue with barriers** for the **reader–writer** pattern: reads run in parallel with `sync`, writes use `async(flags: .barrier)`, which waits for in-flight reads, runs alone, then lets reads continue. (Barriers only work on custom concurrent queues, not global ones.)

Separate concept: **sync vs async** is about the caller — `sync` blocks the calling thread until the item finishes; `async` returns immediately. Calling `sync` on the serial queue you're already on deadlocks (Q7). In new code, an **actor** replaces the "serial queue protecting state" pattern.

```swift
final class ThreadSafeCache {
  private var storage: [String: Data] = [:]
  private let queue = DispatchQueue(label: "cache", attributes: .concurrent)

  func value(for key: String) -> Data? {
    queue.sync { storage[key] }                       // parallel reads
  }
  func set(_ data: Data, for key: String) {
    queue.async(flags: .barrier) { self.storage[key] = data }   // exclusive write
  }
}
```

---

### 83. What is a DispatchGroup and when do you use it? `Intermediate`

**Short:** Coordinates multiple async tasks, notifying when ALL have completed. enter/leave balance the count.

A `DispatchGroup` tracks a set of tasks and tells you when **all** of them have finished. It's essentially a counter:

- `enter()` increments it before each asynchronous task starts;
- `leave()` decrements it when that task completes (in every path, including errors — `defer { group.leave() }` helps);
- `notify(queue:execute:)` schedules a block to run when the counter returns to zero, without blocking;
- `wait()` / `wait(timeout:)` **blocks** the current thread until then — never on the main thread.

For work you submit yourself, `queue.async(group: group) { ... }` enters and leaves automatically — but only if the work is synchronous inside the closure.

Typical uses: firing several API calls in parallel and updating the UI once all have returned, downloading a batch of images, or waiting for multiple SDKs to initialize.

Pitfalls: unbalanced calls — more `leave()` than `enter()` crashes; a missing `leave()` means `notify` never fires. Results usually need to be collected into shared state, which then needs synchronization. In modern Swift, **`async let`** or a **task group** replaces `DispatchGroup` with structured, cancellable and type-safe code.

```swift
let group = DispatchGroup()
var user: User?
var posts: [Post] = []

group.enter()
fetchUser { result in defer { group.leave() }; user = try? result.get() }
group.enter()
fetchPosts { result in defer { group.leave() }; posts = (try? result.get()) ?? [] }

group.notify(queue: .main) { self.render(user, posts) }   // both done

// Modern equivalent:
// async let u = fetchUser(); async let p = fetchPosts()
// render(try await u, try await p)
```

---

### 84. What is a DispatchSemaphore? `Intermediate`

**Short:** Counting signal that blocks threads. Controls maximum concurrent accesses to a resource.

A `DispatchSemaphore` is a **counter with blocking**: `wait()` decrements it and, if the result is below zero, **blocks the current thread** until someone calls `signal()`, which increments it and wakes a waiter. The initial value decides its role:

- **Value N > 0** — limit concurrency: at most N callers can be inside the protected section at once (e.g. max 3 simultaneous downloads or database connections).
- **Value 1** — acts like a mutex (but prefer a real lock).
- **Value 0** — a signal: one thread waits until another finishes something — historically used to make async APIs synchronous in tests or scripts.

Compared with `DispatchGroup`: a group tells you when a set of tasks has **finished**; a semaphore **limits** or **gates** access.

Cautions: blocking wastes a thread and can cause thread explosion; waiting on the main thread freezes the UI; a semaphore has **no owner**, so the system can't apply priority inheritance — priority inversion (Q89); and a forgotten `signal()` deadlocks forever. **Never** use `semaphore.wait()` inside Swift concurrency to wait for async work (Q97). Modern replacements: an actor or `TaskGroup` with a manual limit for bounded concurrency, `OperationQueue.maxConcurrentOperationCount`, `URLSessionConfiguration.httpMaximumConnectionsPerHost`, and `await` instead of waiting.

```swift
let semaphore = DispatchSemaphore(value: 3)   // max 3 at once
for url in urls {
  DispatchQueue.global().async {
    semaphore.wait()
    defer { semaphore.signal() }
    download(url)
  }
}

// Async alternative: bounded task group
try await withThrowingTaskGroup(of: Void.self) { group in
  for (i, url) in urls.enumerated() {
    if i >= 3 { try await group.next() }      // keep at most 3 in flight
    group.addTask { try await download(url) }
  }
  try await group.waitForAll()
}
```

---

### 85. What is async/await? How does it compare to completion handlers? `Intermediate`

**Short:** Sequential-looking async code. No callback nesting. Errors propagate with throw/catch. No thread blocking.

`async/await` (Swift 5.5, SE-0296) lets asynchronous code be written top-to-bottom like synchronous code. An `async` function can **suspend** at each `await`; while suspended, its thread is released to run other work, and the function later resumes — possibly on a different thread (unless it's isolated to an actor such as `@MainActor`).

Compared with completion handlers:

- **Readability:** no "pyramid of doom" of nested closures; loops, `if`, `guard` and `defer` work naturally across async steps.
- **Errors:** `throws` + `try` + `do/catch` instead of passing `Result`/`Error?` through every callback and forgetting a path.
- **Correctness:** the compiler guarantees the function **returns exactly once** — with completion handlers it's easy to forget to call it on an error path, or call it twice.
- **Cancellation & structure:** tasks form a tree, cancellation propagates, and `async let` / task groups express parallelism (Q86).
- **Safety:** combined with actors and `Sendable`, the compiler checks for data races.
- **Threading:** `@MainActor` code is guaranteed to run on the main thread, removing `DispatchQueue.main.async` hops.

Bridging: call async code from sync code with `Task { }`; wrap old callback APIs with continuations (Q94). Many Apple APIs already have async versions (`URLSession.data(from:)`). Remember that `await` is a **suspension point** — state may change while waiting (Q88).

```swift
// Before: nested callbacks, easy to miss an error path
fetchUser(id) { result in
  switch result {
  case .success(let user):
    fetchAvatar(user.avatarURL) { image in self.show(user, image) }
  case .failure(let error): self.showError(error)
  }
}

// After: linear, errors propagate with throw
@MainActor func load(id: Int) async {
  do {
    let user = try await api.fetchUser(id)
    let avatar = try await api.fetchImage(user.avatarURL)
    show(user, avatar)                 // already on the main actor
  } catch {
    showError(error)
  }
}
```

---

### 86. What is structured concurrency in Swift? `Intermediate`

**Short:** Child tasks cannot outlive their parent scope. Cancellation and errors propagate automatically.

**Structured concurrency** means concurrent work has a **scope**, just like a local variable: child tasks are created inside a scope and are guaranteed to complete (or be cancelled and awaited) before that scope exits. Tasks form a **tree** — a parent task and its children.

What the structure gives you:

- **No leaks of work:** a child can't outlive its parent; if you return or throw early, remaining children are cancelled and awaited automatically.
- **Cancellation propagates down:** cancelling a parent cancels all its children.
- **Errors propagate up:** if a child throws in a throwing task group or `async let` you await, the error reaches the parent and siblings are cancelled.
- **Inheritance:** children inherit priority and task-local values.

The structured tools are **`async let`** (a fixed number of child tasks) and **`withTaskGroup` / `withThrowingTaskGroup` / `withDiscardingTaskGroup`** (a dynamic number). SwiftUI's `.task` modifier is also scoped — to the view's lifetime.

**Unstructured** tasks — `Task { }` and `Task.detached { }` — have no parent scope: you must keep the handle to cancel them, and they run until they finish. They're needed to start async work from synchronous code (a button action), but prefer structured tools inside async code.

```swift
func loadProfile(id: Int) async throws -> Profile {
  async let user = fetchUser(id: id)        // child task 1 starts now
  async let posts = fetchPosts(userId: id)  // child task 2 runs in parallel
  // If fetchUser throws, the posts task is cancelled automatically.
  return try await Profile(user: user, posts: posts)
}   // no child can outlive this function
```

---

### 87. What is an Actor in Swift? `Intermediate`

**Short:** Reference type serializing access to mutable state. Accessing from outside requires await. Prevents data races.

An **actor** is a reference type (like a class) that **protects its mutable state from data races**. Only one task at a time can execute code **isolated** to a given actor; other callers wait their turn. Unlike a lock, waiting doesn't block a thread — the caller **suspends** at an `await`.

Rules the compiler enforces:

- From **outside**, accessing an actor's methods or mutable properties is **asynchronous** — you must `await`, because you may have to wait for the actor.
- From **inside**, access is synchronous.
- Values passed in or out must be **`Sendable`** (Q23).
- `nonisolated` members opt out of isolation (for immutable data or pure computation) and can be called synchronously.

Actors don't support inheritance, and they're always `Sendable`.

**Global actors** apply one actor's isolation across many types and functions. **`@MainActor`** is the global actor bound to the main thread: mark view models, UI code and properties with it to guarantee they run on the main thread. In **Xcode 26**, new app projects set **default actor isolation to `MainActor`** (SE-0466), so unannotated code in the app target is main-actor isolated unless you mark it `nonisolated` or `@concurrent`.

Remember **reentrancy** (Q88): an actor method that `await`s lets other calls run in between, so state can change across suspension points.

```swift
actor BankAccount {
  private(set) var balance: Decimal = 0
  let id: UUID = UUID()                    // immutable: safe to read

  func deposit(_ amount: Decimal) { balance += amount }   // isolated
  nonisolated var displayID: String { id.uuidString }     // no await needed
}

let account = BankAccount()
await account.deposit(100)                 // await from outside
print(await account.balance)
print(account.displayID)

@MainActor final class AccountVM {         // always on the main thread
  var text = ""
}
```

---

### 88. What is actor reentrancy and why is it dangerous? `Advanced`

**Short:** Actor suspends at await, allowing other tasks in. State may change before resumption — invariants can break.

Actors serialize execution, but they are **reentrant**: when an actor-isolated method reaches an `await`, it **suspends and gives up the actor**, so other queued calls can run on the same actor and mutate its state. When the first call resumes, the state it checked before the `await` may no longer be true. The actor holds no lock across suspension points — that's a deliberate design choice to avoid deadlocks.

The bug pattern: **check → await → act**. In the bank example, two transfers both pass the balance check, both suspend at `await other.deposit`, and the account ends up negative; or a cache method checks "not cached", awaits a download, and two callers download the same image twice.

How to deal with it:

- **Mutate state before the `await`**, not after (deduct first, refund on failure).
- **Re-check invariants after every `await`**.
- Keep critical sections **synchronous** — do the state change in one non-suspending method.
- For "do this only once" work, store an **in-flight `Task`** in the actor and let later callers `await` the same task (see Q95, Q128, Q169).

```swift
actor Account {
  var balance: Decimal = 1000

  func transfer(to other: Account, amount: Decimal) async throws {
    guard balance >= amount else { throw BankError.insufficientFunds }
    balance -= amount                  // ✅ mutate BEFORE suspending
    do {
      try await other.deposit(amount)  // other tasks may run on this actor here
    } catch {
      balance += amount                // roll back on failure
      throw error
    }
  }
}
```

---

### 89. What is priority inversion? `Advanced`

**Short:** High-priority task blocked on a resource held by a low-priority task. Medium tasks run freely, starving the high-priority one.

Priority inversion: a high-priority task is blocked waiting for a resource (lock, queue) held by a low-priority task, while medium-priority work keeps running and starves it. GCD and the Swift runtime mitigate this with priority inheritance/escalation: when higher-priority work waits on a serial queue, an os_unfair_lock, or an actor, the work it is waiting on gets boosted. DispatchSemaphore cannot be boosted because it has no owner — one more reason not to use semaphores to wait for async work.

---

### 90. What is thread explosion? How does async/await prevent it? `Advanced`

**Short:** Too many blocked threads exhaust the pool. async/await suspends without blocking, on a pool of about one thread per core.

Thread explosion: many GCD work items block (on locks, synchronous I/O, semaphores), so GCD keeps spawning threads to keep cores busy — potentially dozens or hundreds of blocked threads, each with its own stack (512 KB by default for secondary threads) and context-switch overhead. Swift concurrency prevents this: awaiting suspends the task instead of blocking the thread, and the cooperative pool is limited to roughly one thread per CPU core, so the freed thread runs other tasks.

---

### 91. Task {} vs Task.detached {}? `Intermediate`

**Short:** Task {} inherits actor isolation, priority and task-locals. Task.detached inherits none — rarely what you want.

Task { } created on the main actor runs its body on the main actor and inherits priority and task-local values; it's unstructured, so you keep the handle if you need to cancel it. Task.detached starts with no actor isolation, its own priority, and no task-locals. Prefer structured child tasks (async let, task groups), then Task; use detached only when you explicitly must not inherit context. Neither is cancelled automatically when the creating scope ends.

---

### 92. async let vs TaskGroup? `Intermediate`

**Short:** async let: a fixed number of concurrent children known at compile time. TaskGroup: a dynamic number of children.

Both create structured child tasks that can't outlive their scope and are cancelled if the scope exits early. async let suits a known, small set of different operations awaited together. withTaskGroup/withThrowingTaskGroup suits a dynamic collection — one child per URL — and yields results in completion order, not submission order, so carry an index if order matters. If a child throws in a throwing group, remaining children are cancelled when the error propagates.

```swift
let images = try await withThrowingTaskGroup(of: UIImage.self) { group in
  for url in urls { group.addTask { try await load(url) } }
  var result: [UIImage] = []
  for try await img in group { result.append(img) }
  return result // completion order, not input order
}
```

---

### 93. How does task cancellation work in Swift concurrency? `Intermediate`

**Short:** Cooperative: cancel() only sets a flag. Check Task.isCancelled or call checkCancellation(); many APIs throw CancellationError.

Cancelling a task — directly, via its parent, or when a SwiftUI .task's view disappears — only marks it cancelled; nothing stops on its own. Long loops should call try Task.checkCancellation() or check Task.isCancelled. Task.sleep and URLSession's async APIs throw CancellationError when cancelled. A common bug is try? await Task.sleep(...), which swallows the CancellationError so the code carries on and writes stale results. withTaskCancellationHandler reacts immediately to cancellation.

```swift
func load(id: Int) async throws -> Detail {
  try await Task.sleep(for: .seconds(1)) // throws if cancelled
  // try? here would swallow cancellation and keep going
  try Task.checkCancellation()
  return try await api.detail(id)
}
```

---

### 94. How do you bridge a completion-handler API to async/await? `Advanced`

**Short:** withCheckedContinuation / withCheckedThrowingContinuation — and resume exactly once on every path.

Wrap the callback-based API in **`withCheckedContinuation`** (non-throwing) or **`withCheckedThrowingContinuation`** (throwing). The closure you pass receives a `continuation`; the current task suspends until you call one of its `resume` methods from the callback:

- `resume(returning:)` with a value,
- `resume(throwing:)` with an error,
- `resume(with:)` with a `Result` — the most concise when the old API already delivers `Result`.

The contract: **resume exactly once on every code path.** Resuming twice is a fatal error (crash). Never resuming leaks the task — it stays suspended forever; checked continuations log a warning ("SWIFT TASK CONTINUATION MISUSE") when the continuation is deallocated without being resumed.

**Checked vs unsafe:** `withUnsafeContinuation` skips the runtime checks for a tiny performance gain — only switch after the checked version is proven correct.

Other cases:

- Callbacks that fire **many times** (location updates, progress, delegate events) → use **`AsyncStream`** and its continuation's `yield`/`finish`.
- **Delegate-based** APIs → store the continuation in a property and resume it from the delegate method, then set it to `nil`.
- **Cancellation** isn't automatic: wrap with `withTaskCancellationHandler` to cancel the underlying operation.

```swift
func fetchUser(id: Int) async throws -> User {
  try await withCheckedThrowingContinuation { continuation in
    legacyFetch(id) { result in
      continuation.resume(with: result)           // exactly once
    }
  }
}

func locationUpdates() -> AsyncStream<CLLocation> {
  AsyncStream { continuation in
    let delegate = LocationDelegate { continuation.yield($0) }   // many values
    continuation.onTermination = { _ in delegate.stop() }
    delegate.start()
  }
}
```

---

### 95. Data race vs race condition — what do actors prevent? `Advanced`

**Short:** Data race: unsynchronized concurrent access with a write. Race condition: logic depends on timing. Actors prevent only the first.

A data race is memory-unsafe concurrent access where at least one access is a write; Swift 6's compile-time checking and actor isolation eliminate it. A race condition is a logic bug where the result depends on timing, and actors don't prevent it: an actor method that checks a cache, awaits a download, then writes can run twice concurrently because of reentrancy, downloading the same thing twice. Fix it by storing the in-flight Task in the actor and having later callers await it.

---

### 96. Where does a nonisolated async function run? What is @concurrent? `Advanced`

**Short:** Before Swift 6.2 (or with the feature off): the global executor. With SE-0461: the caller's actor, unless marked @concurrent.

This depends on the language mode and build settings, so know both behaviors:

- **Before Swift 6.2, or with the feature off (SE-0338):** a `nonisolated async` function always **leaves** the caller's actor and runs on the **global concurrent executor** (the cooperative thread pool). Calling it from `@MainActor` code hops off the main thread — good for heavy work, but every argument and result must be `Sendable`, which produced many confusing errors.
- **Swift 6.2 with SE-0461** (upcoming feature `NonisolatedNonsendingByDefault`): a `nonisolated async` function now runs **on the caller's actor** by default (spelled explicitly `nonisolated(nonsending)`). Called from the main actor, it stays on the main actor; values don't cross an isolation boundary, so far fewer `Sendable` errors.
- **`@concurrent`** opts a function back into always running on the global executor — use it for CPU-heavy work (decoding large JSON, image processing) that must not block the caller's actor.

In **Xcode 26**, the **Approachable Concurrency** build setting turns on SE-0461 together with related upcoming features (inferring isolated conformances, inferring Sendable for methods and key-path literals, and others), and new app projects also default to **MainActor isolation** (SE-0466). So in a new project, most code runs on the main actor unless you mark it `nonisolated` or `@concurrent`. Always check your target's settings before reasoning about which thread code runs on.

```swift
nonisolated func parse(_ data: Data) async -> Model { ... }      // SE-0461: caller's actor

@concurrent
nonisolated func decodeLarge(_ data: Data) async throws -> [Item] { // always off-actor
  try JSONDecoder().decode([Item].self, from: data)
}

@MainActor func reload() async throws {
  let items = try await decodeLarge(data)   // runs in the thread pool
  self.items = items                        // back on the main actor
}
```

---

### 97. Why must you never block inside async code? `Intermediate`

**Short:** The cooperative pool has about one thread per core; semaphore.wait or Thread.sleep starves it and can deadlock.

Swift concurrency's cooperative thread pool assumes tasks make forward progress and suspend at await. Blocking calls — DispatchSemaphore.wait for another task, Thread.sleep, synchronous network or file I/O — hold a pool thread, and a few of those can stall or deadlock the whole pool. Use await-based APIs instead: Task.sleep, continuations, actors, AsyncStream. Also, async alone doesn't move work off the main actor — CPU-heavy work in a @MainActor function still blocks the UI.

---

## Combine (14)

### 98. What is the Combine framework? `Intermediate`

**Short:** Reactive programming: Publishers emit values, Operators transform, Subscribers receive. Type-safe, first-party.

Combine (iOS 13+) is Apple's framework for **processing values over time** declaratively. Three roles:

- **Publishers** emit values and then, optionally, one completion (`.finished` or `.failure`): `Just`, `Future`, `PassthroughSubject`/`CurrentValueSubject`, `@Published` properties (`$name`), `URLSession.dataTaskPublisher`, `NotificationCenter.publisher`, `Timer.publish`.
- **Operators** transform, filter and combine streams: `map`, `filter`, `compactMap`, `removeDuplicates`, `debounce`, `throttle`, `combineLatest`, `merge`, `zip`, `flatMap`, `switchToLatest`, `catch`, `retry`, `receive(on:)`.
- **Subscribers** consume values: `sink`, `assign(to:)`, or custom ones. Nothing happens until something subscribes; the returned `AnyCancellable` keeps the subscription alive.

It's strongly typed (`Output` and `Failure` types are checked at compile time) and handles **backpressure** via demand. Compared with RxSwift it has no third-party dependency and integrates with Foundation and (pre-iOS 17) SwiftUI's `ObservableObject`.

Where it fits today: Combine is stable but Apple's newer APIs favor **async/await** and **Observation**. Use Combine where it's strongest — **time-based composition** of event streams (search-as-you-type, form validation, combining several sources) — and async/await for one-shot work like a single network request.

```swift
URLSession.shared.dataTaskPublisher(for: url)
  .map(\.data)
  .decode(type: User.self, decoder: JSONDecoder())
  .receive(on: DispatchQueue.main)
  .sink(receiveCompletion: { completion in
          if case .failure(let error) = completion { print(error) }
        },
        receiveValue: { [weak self] in self?.user = $0 })
  .store(in: &cancellables)
```

---

### 99. What are a Publisher and a Subscriber in Combine? `Basic`

**Short:** Publisher emits values then at most one completion (finished/failure). Subscriber requests demand and receives them.

A Publisher declares Output and Failure types and emits zero or more values followed by at most one completion (.finished or .failure). Nothing happens until a Subscriber attaches: the publisher hands it a Subscription, the subscriber requests demand, and values start flowing. sink and assign are the built-in subscribers and both request unlimited demand. Operators such as map are themselves publishers that wrap an upstream publisher.

```swift
let cancellable = [1, 2, 3].publisher
  .map { $0 * 10 }
  .sink { print($0) }   // 10, 20, 30
```

---

### 100. Is Future lazy or eager? How do you make it lazy? `Intermediate`

**Short:** Eager: its closure runs when the Future is created and the result is cached. Wrap it in Deferred to run per subscription.

`Future` is **eager**: its closure runs **immediately when the `Future` is created**, not when someone subscribes. It then stores the single result (value or error) and **replays** it to every subscriber, current and future — it never runs the work again.

Consequences:

- The work runs even if **nobody ever subscribes** (a request fires during object setup).
- **Multiple subscribers share one execution** — sometimes exactly what you want (like a cached promise), sometimes not.
- **`retry()` doesn't retry**: resubscribing to a failed `Future` just replays the stored failure.
- Creating the `Future` inside a function that's called later is fine; storing one in a property means the work runs at init.

To make it **lazy** (run per subscription), wrap it in **`Deferred`**: `Deferred` calls its closure each time a subscriber attaches, creating a brand-new `Future` — and new work — for each subscription. That makes `retry` work as expected and delays the side effect until something actually listens.

A related gotcha: `Future`'s promise must be fulfilled exactly once; additional calls are ignored. When bridging to async code, a `Future` that starts a `Task` won't cancel that task on cancellation unless you handle it.

```swift
let eager = Future<Int, Error> { promise in
  print("Started!")                       // prints immediately at creation
  fetchCount { promise($0) }
}

let lazy = Deferred {
  Future<Int, Error> { promise in
    fetchCount { promise($0) }            // runs per subscription
  }
}
.retry(2)                                 // actually re-runs the work
```

---

### 101. PassthroughSubject vs CurrentValueSubject? `Basic`

**Short:** Passthrough: no stored value, late subscribers miss earlier sends. CurrentValue: holds .value and replays it on subscribe.

Subjects are publishers you **push values into** imperatively with `send(_:)` (and `send(completion:)`), which makes them the bridge from imperative code (delegate callbacks, button taps) into Combine.

- **`PassthroughSubject<Output, Failure>`** stores **nothing**. A value is delivered to whoever is subscribed at that moment; subscribers that attach later never see it. Use it for **events**: "button tapped", "item deleted", "show alert".
- **`CurrentValueSubject<Output, Failure>`** requires an **initial value**, always holds the latest one in `.value` (readable and writable synchronously), and **immediately sends the current value** to each new subscriber, followed by later changes. Use it for **state**: the current user, a loading flag, the selected filter.

Both are **hot** — all subscribers share the same stream — and both stop emitting once they receive a completion. A `@Published` property behaves much like a `CurrentValueSubject` (emits the current value on subscribe), except it emits in `willSet` and never completes (Q102).

Encapsulation tip: keep subjects `private` and expose them as `AnyPublisher` via `eraseToAnyPublisher()`, so only the owner can call `send`.

```swift
let current = CurrentValueSubject<Int, Never>(0)
current.send(1)
let a = current.sink { print("A", $0) }   // prints "A 1" immediately
print(current.value)                      // 1

let events = PassthroughSubject<String, Never>()
events.send("lost")                       // no subscriber yet → dropped
let b = events.sink { print("B", $0) }
events.send("tap")                        // prints "B tap"
```

---

### 102. How does @Published work, and when exactly does it emit? `Intermediate`

**Short:** $property emits the current value on subscribe, then each change — during willSet, before the new value is stored.

@Published wraps a stored property of a class; $property is a Published.Publisher that emits the current value when subscribed and then every new value. It emits in willSet, so reading the property itself inside sink still returns the old value — use the emitted value instead. It never completes and works in any class; inside an ObservableObject it also triggers objectWillChange. With @Observable (iOS 17) you don't use @Published at all.

```swift
final class VM { @Published var query = "" }
let vm = VM()
let c = vm.$query.sink { new in
  print(new, vm.query) // vm.query is still the old value
}
vm.query = "swift"     // prints: swift (old: "")
```

---

### 103. What is the difference between cold and hot publishers? `Intermediate`

**Short:** Cold: work starts per subscriber (Just, dataTaskPublisher). Hot: one shared live stream (subjects); late subscribers miss values.

A cold publisher does its work separately for each subscriber — two sinks on a dataTaskPublisher make two network requests. A hot publisher, such as a subject or NotificationCenter publisher, emits regardless of who listens, so late subscribers only see later values. Use share() (or multicast with a subject) to turn a cold publisher into one shared subscription, e.g. so one request feeds several subscribers.

```swift
let shared = URLSession.shared
  .dataTaskPublisher(for: url)
  .map(\.data)
  .share()   // one request, many subscribers
```

---

### 104. flatMap vs switchToLatest — which do you use for search-as-you-type? `Advanced`

**Short:** flatMap merges all inner publishers, so stale results can arrive late. map + switchToLatest cancels the previous inner one.

flatMap maps each value to a publisher and merges their outputs; maxPublishers defaults to .unlimited, so inner requests run concurrently and a slow old response can arrive after a newer one. map { ... }.switchToLatest() keeps only the most recent inner publisher and cancels the previous one — ideal for search, where stale results must be dropped. To process inner publishers strictly one at a time in order, use flatMap(maxPublishers: .max(1)).

```swift
$query
  .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
  .removeDuplicates()
  .map { [api] in api.search($0) } // AnyPublisher<[Item], Never>
  .switchToLatest()          // cancels stale requests
  .assign(to: &$results)
```

---

### 105. debounce vs throttle? `Basic`

**Short:** debounce: emit the last value after a quiet period. throttle: at most one value per interval (first or latest).

debounce waits until the upstream has been silent for the given interval and then emits the most recent value — perfect for search fields. throttle emits at most one value per interval regardless of how fast values arrive; latest: true picks the last value in each window, false the first — good for scroll or sensor events. Both need a scheduler for their timers, usually DispatchQueue.main in UI code. Pair them with removeDuplicates, which only drops consecutive equal values.

```swift
$query
  .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
  .removeDuplicates()
```

---

### 106. combineLatest vs zip vs merge? `Intermediate`

**Short:** combineLatest: latest of each whenever any emits. zip: pairs values by index. merge: interleaves streams of the same type.

combineLatest emits a tuple of the latest value from each publisher whenever any of them emits (after all have emitted once) — ideal for form validation. zip waits for one new value from each publisher and pairs them in lockstep, e.g. combining two parallel request results. merge interleaves values from publishers with identical Output and Failure types into one stream without pairing them.

```swift
$email.combineLatest($password)
  .map { $0.contains("@") && $1.count >= 8 }
  .assign(to: &$isValid)
```

---

### 107. What happens when a Combine publisher fails, and how do you recover? `Intermediate`

**Short:** Failure is terminal — the stream ends. Recover with catch, replaceError(with:), or retry (resubscribes upstream).

A failure completes the stream; no more values arrive. catch replaces the failed publisher with a fallback publisher; replaceError(with:) emits one value and finishes; retry(n) resubscribes upstream. tryMap turns a thrown error into a failure (Failure becomes Error) and mapError converts error types. Put retry before decode so a decoding error doesn't trigger another fetch, and remember that retry on a non-deferred Future just replays the cached failure.

```swift
api.dataPublisher(for: url)
  .retry(2)                       // only network failures retried
  .decode(type: User.self, decoder: JSONDecoder())
  .catch { _ in Just(User.placeholder) }
  .receive(on: DispatchQueue.main)
```

---

### 108. subscribe(on:) vs receive(on:)? `Advanced`

**Short:** receive(on:) moves downstream delivery (e.g. to main). subscribe(on:) moves subscription, demand and cancel calls upstream.

receive(on:) changes the scheduler on which downstream operators and the subscriber receive values — typically DispatchQueue.main before UI updates. subscribe(on:) changes where subscription, demand requests and cancellation are performed upstream; it only moves value production for publishers that do their work in response to subscribing, such as a Deferred computation. A subject delivers values on whatever thread calls send(), regardless of subscribe(on:).

```swift
Deferred { Just(expensiveParse(data)) }
  .subscribe(on: DispatchQueue.global())  // parse off main
  .receive(on: DispatchQueue.main)        // deliver on main
  .sink { [weak self] in self?.items = $0 }
```

---

### 109. How do subscriptions stay alive, and how do they leak? `Intermediate`

**Short:** A subscription lives while its AnyCancellable does. Store it in a Set and use [weak self] to avoid self → set → closure → self.

sink and assign(to:on:) return an AnyCancellable; when it is deallocated or cancel() is called, the subscription ends. store(in: &cancellables) ties it to the owner's lifetime. If the closure captures self strongly you get a cycle: self owns the set, the set owns the cancellable, the closure owns self — use [weak self]. assign(to:on:) always retains its target strongly; prefer assign(to: &$property) (iOS 14), which returns nothing and lives as long as the @Published property.

```swift
vm.$count
  .sink { [weak self] in self?.label.text = "\($0)" }
  .store(in: &cancellables)
// .assign(to: \.title, on: self) would retain self
```

---

### 110. How do Combine and async/await interoperate? `Intermediate`

**Short:** Publisher to async: for await x in publisher.values. Async to Combine: a Future or Deferred that starts a Task.

Every publisher exposes .values, an AsyncSequence — use for await, or for try await when Failure isn't Never. .values requests one value at a time, so a hot subject emitting faster than the loop consumes can drop values (add buffer). In the other direction, wrap async work in a Future that starts a Task (cancelling the subscription won't cancel that Task unless you handle it). Use Combine for time-based composition like debounce and combineLatest; async/await for one-shot sequential work.

```swift
for await value in vm.$query.values {
  print(value)
}
// failing publisher: for try await x in pub.values
```

---

### 111. Why use eraseToAnyPublisher()? `Intermediate`

**Short:** Hides long nested operator types behind AnyPublisher<Output, Failure>, keeping APIs stable and implementations private.

Every Combine operator returns a new generic type wrapping its upstream: `$query.debounce(...).removeDuplicates().map(...)` has a type like `Publishers.Map<Publishers.RemoveDuplicates<Publishers.Debounce<Published<String>.Publisher, DispatchQueue>>, [Item]>`.

Exposing that type in an API has two problems:

1. **It leaks implementation details** — callers (and your protocol) are tied to the exact operator chain.
2. **It's fragile** — adding a `retry` or `filter` changes the return type and breaks every caller and conforming mock.

`eraseToAnyPublisher()` wraps the chain in **`AnyPublisher<Output, Failure>`**, so the signature only promises *what* is emitted and how it can fail. It's the standard return type for repository and service methods and for protocol requirements, and it lets a test mock return `Just(value).setFailureType(to: Error.self).eraseToAnyPublisher()` with the same type.

Costs and alternatives: one small indirection per event, negligible in practice. You can also return an opaque type — `some Publisher<[Item], Never>` — which hides the concrete type while keeping static typing; but a protocol requirement or a property whose implementation varies (live vs mock) still needs `AnyPublisher`. Similarly, expose subjects as `AnyPublisher` so callers can't call `send` on them.

```swift
protocol SearchService {
  func search(_ q: String) -> AnyPublisher<[Item], Never>
}

final class LiveSearch: SearchService {
  private let resultsSubject = PassthroughSubject<[Item], Never>()
  var results: AnyPublisher<[Item], Never> { resultsSubject.eraseToAnyPublisher() } // read-only

  func search(_ q: String) -> AnyPublisher<[Item], Never> {
    client.items(matching: q)
      .replaceError(with: [])
      .eraseToAnyPublisher()
  }
}

struct MockSearch: SearchService {
  func search(_ q: String) -> AnyPublisher<[Item], Never> { Just([.fixture]).eraseToAnyPublisher() }
}
```

---

## Architecture (12)

### 112. What is MVVM and why is it preferred over MVC? `Basic`

**Short:** Model-View-ViewModel. ViewModel has no UIKit import — fully unit-testable. No Massive ViewController.

**MVVM** splits a screen into three roles:

- **Model** — domain data and business rules (structs, services, repositories).
- **ViewModel** — turns model data into **view-ready state** (formatted strings, `isLoading`, error messages, enabled/disabled flags) and exposes **intents** the view calls (`load()`, `didTapSave()`). It talks to services, but has **no UIKit/SwiftUI view references**.
- **View** (a SwiftUI view, or a UIViewController + views in UIKit) — renders the ViewModel's state and forwards user actions. It never touches the model or services directly.

Binding the view to the ViewModel uses `@Observable`/`ObservableObject` in SwiftUI, or Combine, closures or delegate callbacks in UIKit.

Why teams prefer it over Apple-style MVC:

- **Testability** — presentation logic lives in a plain class you can unit test without a simulator.
- **Smaller view controllers** — the VC shrinks to lifecycle and layout.
- **Clear state** — modelling a screen as a state value (`enum ViewState { case loading, loaded([Item]), failed(String) }`) prevents impossible combinations.

Weak spots to mention: ViewModels can become "massive" too, navigation doesn't belong in them (use a coordinator/router), and in SwiftUI a ViewModel that only forwards calls adds little (Q121).

```swift
@MainActor @Observable
final class ProductsViewModel {
  enum State { case loading, loaded([Product]), failed(String) }
  private(set) var state: State = .loading
  private let repository: ProductRepository

  init(repository: ProductRepository) { self.repository = repository }

  func load() async {
    do { state = .loaded(try await repository.products()) }
    catch { state = .failed("Couldn't load products.") }
  }
}
```

---

### 113. What is MVC and what is its main problem in iOS? `Basic`

**Short:** Model-View-Controller. UIViewController becomes Massive View Controller — too many responsibilities.

**MVC** is Apple's classic UIKit pattern:

- **Model** — data and business logic.
- **View** — UI elements (`UIView`, cells, storyboards) that display data and send user actions.
- **Controller** — mediates: updates views from the model and updates the model from user actions.

The problem in iOS is that `UIViewController` is **tightly coupled to its view** — it owns the view's lifecycle (`viewDidLoad`, `viewWillAppear`), layout and rotation, so View and Controller merge into one class. Then everything else lands there too: networking, JSON parsing, validation, formatting, table view data source and delegate, navigation, analytics. The result is the **Massive View Controller**: thousands of lines, many reasons to change, and logic that can't be unit-tested without instantiating UIKit.

How to fix it without abandoning UIKit:

- move networking and persistence into **services/repositories**,
- move presentation logic into a **ViewModel or presenter** (MVVM/MVP),
- move navigation into **coordinators**,
- split large screens into **child view controllers**,
- move data source/delegate code into separate objects, or use diffable data sources and cell configurations,
- move business rules into **use cases** (Clean Architecture).

MVC is still fine for small screens — the problem is putting everything in one place, not the pattern itself.

---

### 114. What is the Singleton pattern? What are its drawbacks? `Basic`

**Short:** One shared global instance. Drawbacks: hidden dependencies, global mutable state, untestable in isolation.

The **Singleton** pattern guarantees a single shared instance accessed globally — in Swift: `static let shared = Thing()` with a `private init()` (the `static let` is lazily initialized and thread-safe). Apple uses it for resources that genuinely exist once per process: `URLSession.shared`, `UserDefaults.standard`, `FileManager.default`, `NotificationCenter.default`, `UIApplication.shared`.

Drawbacks:

- **Hidden dependencies** — a type calling `Analytics.shared` inside a method doesn't declare that dependency, so you can't tell what it needs from its API.
- **Global mutable state** — any code can change it, so bugs become order-dependent and hard to trace; with concurrency it also needs synchronization (in Swift 6, a non-Sendable global is a compile error).
- **Testing** — tests share state and can't substitute a fake easily, so they become slow, flaky or order-dependent.
- **Lifetime** — it lives forever; resetting it on logout is awkward.

Balanced answer: the shared *instance* isn't the problem; *reaching for it from everywhere* is. Create one instance, but **inject it** behind a protocol (constructor injection with a default value is a pragmatic middle ground), so production gets the shared object and tests get a mock.

```swift
protocol Analytics { func track(_ event: String) }

final class FirebaseAnalytics: Analytics {
  static let shared = FirebaseAnalytics()    // still one instance
  private init() {}
  func track(_ event: String) { /* ... */ }
}

final class CheckoutViewModel {
  private let analytics: Analytics           // injected, not looked up
  init(analytics: Analytics = FirebaseAnalytics.shared) { self.analytics = analytics }
}
// Test: CheckoutViewModel(analytics: SpyAnalytics())
```

---

### 115. What is the Delegation pattern? Why is the delegate weak? `Basic`

**Short:** Object delegates responsibilities via a protocol. Delegate is weak to prevent retain cycles between delegator and owner.

**Delegation** lets one object (the delegator — a table view, a text field, a custom picker) hand some decisions or event handling to another object (the delegate) through a **protocol**. The delegator stays generic and reusable; it only knows "something conforming to this protocol". Delegate methods often pass the delegator as the first argument (`tableView(_:didSelectRowAt:)`) so one delegate can serve several instances, and some return values to influence behavior (`textFieldShouldReturn` → `Bool`).

**Why `weak`:** in the usual ownership graph the delegate **owns** the delegator — a view controller holds its table view (through its view) or a service it created. If the delegator also held the delegate strongly, you'd have VC → tableView → VC, a retain cycle, and the screen would never be deallocated. A weak reference expresses "I talk to you, but I don't keep you alive".

Requirements: `weak` works only with class types, so the protocol must be class-constrained with **`AnyObject`** (`protocol FetchDelegate: AnyObject`). The property must be an optional `var`, and callers use optional chaining, which also handles "no delegate set". Exception: some APIs intentionally retain their delegate — `URLSession` keeps a strong reference to its delegate until the session is invalidated — so read the docs.

```swift
protocol FetcherDelegate: AnyObject {               // AnyObject allows weak
  func fetcher(_ fetcher: Fetcher, didFetch data: Data)
  func fetcher(_ fetcher: Fetcher, didFail error: Error)
}

final class Fetcher {
  weak var delegate: FetcherDelegate?               // no retain cycle
  func finish(_ data: Data) { delegate?.fetcher(self, didFetch: data) }
}

final class ListViewController: UIViewController, FetcherDelegate {
  private let fetcher = Fetcher()                   // VC owns fetcher
  override func viewDidLoad() { super.viewDidLoad(); fetcher.delegate = self }
  func fetcher(_ f: Fetcher, didFetch data: Data) { /* update UI */ }
  func fetcher(_ f: Fetcher, didFail error: Error) { /* show error */ }
}
```

---

### 116. What is the Observer pattern and how is it implemented in iOS? `Basic`

**Short:** Subject notifies registered observers when state changes without knowing who observes it.

The **Observer** pattern defines a one-to-many dependency: a **subject** keeps a list of **observers** and notifies them when its state changes, without knowing what they are. It decouples the producer of changes from the code that reacts to them.

iOS implementations, from oldest to newest:

- **NotificationCenter** — broadcast by name; any number of observers anywhere in the app; very loose coupling but untyped (`userInfo` dictionary) and hard to trace (Q120).
- **Key-Value Observing (KVO)** — observe a property of an `NSObject` subclass; the property must be `@objc dynamic`. Swift's block API `observe(\.keyPath)` returns an `NSKeyValueObservation` token that stops observing when deallocated. Still used for system objects (`AVPlayer.status`, `WKWebView.estimatedProgress`).
- **Delegates/closures** — one-to-one variants of the same idea.
- **Combine** — `@Published` properties and subjects are typed publishers; subscribers get values and completion, with operators for transformation (Q98).
- **Observation framework** (`@Observable`, iOS 17) — property-level change tracking used by SwiftUI and (iOS 26) UIKit; `withObservationTracking` lets non-UI code observe a change.

Things to discuss: avoiding leaks (observers holding the subject or `self` strongly), removing or cancelling observations, and which thread notifications arrive on.

```swift
// KVO on a system object
var observation: NSKeyValueObservation?
observation = player.observe(\.status, options: [.new]) { player, _ in
  print("Status:", player.status.rawValue)
}   // set observation = nil to stop

// Combine
final class Cart { @Published var items: [Item] = [] }
let cancellable = cart.$items.sink { print("Count:", $0.count) }
```

---

### 117. What is the Factory pattern? Give an iOS example. `Intermediate`

**Short:** Centralizes object creation behind a method. Decouples creation from usage. dequeueReusableCell is a classic factory.

The **Factory** pattern moves object creation behind a method or object, so callers ask for "a thing" without knowing the concrete type or how to build it. Variants:

- **Factory method** — a function or static method that decides which concrete type to return (`PaymentMethodFactory.make(for: .applePay)`), often returning a protocol type.
- **Abstract factory** — an object that creates families of related objects (`ThemeFactory` producing buttons and labels for light or premium themes).

Benefits: callers depend on abstractions, creation logic (configuration, dependencies, choosing a subclass) lives in one place, and tests can supply a factory that produces mocks.

iOS examples:

- **`dequeueReusableCell(withIdentifier:for:)`** — you request a cell by identifier; the table view decides whether to create a new one or reuse one from its queue.
- `UIButton(configuration:)` and `UIFont.preferredFont(forTextStyle:)` return objects configured for you.
- In app code, a **screen factory** used by coordinators: it builds a view controller with its view model and injected services, so the coordinator doesn't know the dependency graph.

```swift
protocol ScreenFactory {
  func makeProductList(onSelect: @escaping (Product) -> Void) -> UIViewController
  func makeProductDetail(_ product: Product) -> UIViewController
}

struct LiveScreenFactory: ScreenFactory {
  let api: APIClient
  func makeProductList(onSelect: @escaping (Product) -> Void) -> UIViewController {
    let vm = ProductListViewModel(repository: ProductRepository(api: api), onSelect: onSelect)
    return ProductListViewController(viewModel: vm)
  }
  func makeProductDetail(_ product: Product) -> UIViewController {
    ProductDetailViewController(viewModel: .init(product: product, api: api))
  }
}
```

---

### 118. What is the Facade pattern? `Intermediate`

**Short:** Provides a simple unified interface to a complex subsystem. Hides internal coordination from callers.

The **Facade** pattern puts a **simple, high-level interface** in front of a complex subsystem. Callers talk to one object with intention-revealing methods; the facade coordinates the many lower-level objects inside.

iOS example: a `NetworkService` facade exposing `fetchUser(id:)`. Internally it builds the `URLRequest`, adds headers and the auth token, refreshes the token on 401, retries transient failures, checks the status code, decodes JSON with the configured decoder, maps errors to app-level errors, and logs. The view model calls one method and knows none of that. Other common facades: a `MediaPlayer` wrapping AVFoundation's player, item, audio session and observers; a `PaymentService` wrapping StoreKit; an `AnalyticsService` hiding several SDKs.

Benefits: callers are simpler and decoupled from the subsystem, you can change internals (Alamofire → URLSession) without touching callers, and the facade's protocol is an easy seam for mocking. Risks: a facade that keeps growing becomes a **God object** — keep it focused on one subsystem, and let advanced callers use lower-level APIs when needed.

Difference from similar patterns: an **Adapter** converts one interface into another expected interface; a **Facade** simplifies a whole subsystem.

```swift
final class NetworkService {
  private let session: URLSession
  private let auth: AuthManager
  private let decoder: JSONDecoder

  init(session: URLSession, auth: AuthManager, decoder: JSONDecoder) {
    self.session = session; self.auth = auth; self.decoder = decoder
  }

  func fetchUser(id: Int) async throws -> User {    // one simple call for callers
    var request = URLRequest(url: Endpoint.user(id).url)
    request.setValue("Bearer \(try await auth.validToken())", forHTTPHeaderField: "Authorization")
    let (data, response) = try await session.data(for: request)
    guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw APIError.badStatus }
    return try decoder.decode(User.self, from: data)
  }
}
```

---

### 119. What is an anti-pattern? Give iOS examples. `Intermediate`

**Short:** Common solution that creates more problems than it solves. iOS: Massive VC, God Object, Singleton overuse.

An **anti-pattern** is a solution that looks reasonable and is commonly used, but reliably creates more problems than it solves — usually showing up later as bugs, slow changes or untestable code. Knowing them helps you explain *why* a design is bad, not just that it is.

iOS examples:

- **Massive View Controller** — networking, parsing, formatting, navigation and business logic all in one `UIViewController`.
- **God object / God service** — one `AppManager` or `Utils` class that knows everything and that every file imports.
- **Singleton overuse** — global mutable state accessed from everywhere, hiding dependencies and breaking tests (Q114).
- **Prop drilling** — passing data through many intermediate views that don't use it, instead of DI or the environment.
- **Stringly-typed code** — notification names, segue identifiers, `userInfo` keys and JSON keys as raw strings scattered around.
- **Force unwrapping and `try!`** everywhere — turning recoverable conditions into crashes.
- **Copy-paste programming** and "boolean soup" state (`isLoading`, `hasError`, `isEmpty` that can contradict each other) instead of an enum state.
- **Premature abstraction** — protocols with one implementation and layers that just forward calls.

In an interview, pair each with the remedy you'd apply (extract services, inject dependencies, model state as an enum, use typed constants).

---

### 120. What is NotificationCenter and when should you use it? `Basic`

**Short:** Broadcast messaging. Post named notifications; any observer receives without knowing the sender.

NotificationCenter provides one-to-many broadcast communication: a poster calls post(name:object:userInfo:) and every registered observer receives it, without either knowing the other. Use it for system events (keyboard, app lifecycle) and loosely coupled cross-module messages. Drawbacks: untyped userInfo and hidden control flow. With the block-based API, keep the returned token and pass it to removeObserver(_:) when done; selector-based observers are removed automatically since iOS 9.

```swift
NotificationCenter.default.addObserver(
  forName: UIResponder.keyboardWillShowNotification,
  object: nil, queue: .main) { [weak self] n in
  self?.adjustForKeyboard(n)
}
```

---

### 121. MV vs MVVM vs TCA in SwiftUI? `Intermediate`

**Short:** MV: views bind to @Observable models/stores. MVVM: per-screen view models. TCA: reducer, state, actions, effects.

With @Observable, a model or store that owns state and exposes intent methods can be bound directly by views (MV); a ViewModel that only forwards calls 1:1 adds nothing. MVVM still helps when a screen needs formatting or a state machine testable without views. TCA (Point-Free) centralizes state in a pure reducer with explicit actions and effects — very testable and predictable, at the cost of a dependency and boilerplate. Choose by team size, testing needs and complexity.

---

### 122. What is the dependency rule in Clean Architecture? `Advanced`

**Short:** Dependencies point inward: UI → use cases → entities. Inner layers define protocols; outer layers (network, DB) implement them.

Code is layered from entities (business rules) and use cases in the center to presentation, networking and persistence on the outside. Source dependencies only point inward: a use case depends on a Repository protocol it defines, and the outer data layer implements it. All the wiring happens in one composition root, typically the app target. The payoff is testable, framework-independent business logic; the cost is more types and indirection, so scale it to the app's size.

---

### 123. How do you modularize an iOS app with Swift packages? `Advanced`

**Short:** Feature modules depend on shared core modules, not on each other; split interface from implementation; wire it in the app target.

Split the app into local Swift packages: core modules (networking, design system, models) and feature modules that depend only on core. Features don't import each other; cross-feature navigation goes through interface modules or a router injected by the app target. Benefits: faster incremental builds, boundaries enforced by access control, parallel team work, and features testable in isolation. Watch linking: many dynamic frameworks slow launch, so prefer static linking.

---

## Networking (9)

### 124. Steps to make a network request with URLSession? `Basic`

**Short:** Create URL → URLRequest → URLSession.data → decode → handle errors → dispatch to main thread.

1. **Build the URL** — preferably with `URLComponents` and `URLQueryItem`s, so query parameters are percent-encoded correctly.
2. **Build a `URLRequest`** — HTTP method, headers (`Content-Type`, `Accept`, `Authorization`), body (`JSONEncoder` for JSON), `timeoutInterval`, and `cachePolicy` if needed.
3. **Send it** — `try await session.data(for: request)` (iOS 15+), or the older `dataTask(with:completionHandler:)` plus `resume()`. Use an injected or configured `URLSession`, not always `.shared`.
4. **Validate the response** — cast to `HTTPURLResponse` and check `statusCode` (2xx success; 401 → refresh token or log out; 4xx client error; 5xx server error). URLSession does **not** throw for HTTP error codes, only for transport failures (`URLError`: no connection, timeout, cancelled).
5. **Decode** the `Data` with a configured `JSONDecoder`, and map `DecodingError`s to useful app errors.
6. **Update the UI on the main actor** — `@MainActor` view models make this automatic; with completion handlers, hop to `DispatchQueue.main`.
7. **Handle cancellation** — task cancellation cancels the request in async code; keep the `URLSessionDataTask` to cancel it with callbacks.

Production extras: retries with backoff for transient errors (Q129), logging, and a protocol-based client so it can be tested (Q132).

```swift
func fetchUsers(page: Int) async throws -> [User] {
  var components = URLComponents(string: "https://api.example.com/users")!
  components.queryItems = [URLQueryItem(name: "page", value: "\(page)")]

  var request = URLRequest(url: components.url!)
  request.httpMethod = "GET"
  request.setValue("application/json", forHTTPHeaderField: "Accept")

  let (data, response) = try await URLSession.shared.data(for: request)
  guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
  guard (200..<300).contains(http.statusCode) else { throw APIError.status(http.statusCode) }
  return try JSONDecoder().decode([User].self, from: data)
}
```

---

### 125. What are URLSession session types? `Intermediate`

**Short:** Shared: singleton. Default: disk-caching, configurable. Ephemeral: in-memory only. Background: transfers while suspended.

`URLSession` behavior comes from its `URLSessionConfiguration`:

- **`URLSession.shared`** — a ready-made singleton using a default configuration. Fine for simple requests, but you **can't** change its configuration, set a delegate (for auth challenges, metrics, progress) or use it for background transfers.
- **`.default`** — the standard configuration: persistent **disk cache** (`URLCache`), cookies and credentials stored in the shared stores. Create your own session from it to customize timeouts, headers, cache, `waitsForConnectivity`, `allowsExpensiveNetworkAccess`/`allowsConstrainedNetworkAccess` (cellular/Low Data Mode), and a delegate.
- **`.ephemeral`** — like default but keeps cache, cookies and credentials **in memory only**; everything is discarded when the session is invalidated. Good for private browsing, sensitive flows, or tests that must not share state.
- **`.background(withIdentifier:)`** — hands upload/download tasks to a **system daemon** so they continue while the app is suspended or even terminated by the system (Q131). Delegate-based, file-based uploads only.

Practical advice: create **one long-lived session per configuration** and reuse it — sessions are expensive and own a connection pool; a session with a delegate keeps a strong reference to it until you call `invalidateAndCancel()` or `finishTasksAndInvalidate()`. Set `httpMaximumConnectionsPerHost` to limit parallel requests to one host.

```swift
let config = URLSessionConfiguration.default
config.timeoutIntervalForRequest = 20
config.waitsForConnectivity = true                 // wait instead of failing offline
config.allowsConstrainedNetworkAccess = false      // respect Low Data Mode
config.httpAdditionalHeaders = ["Accept": "application/json"]
let apiSession = URLSession(configuration: config)

let privateSession = URLSession(configuration: .ephemeral)
```

---

### 126. What is SSL Pinning? `Advanced`

**Short:** Hardcodes expected server certificate in the app. Prevents MITM attacks even with rogue certificate authorities.

Normally iOS trusts a server's TLS certificate if it chains to **any** root CA in the device's trust store. **Pinning** adds a check: the app only accepts the connection if the server's certificate — or, better, its **public key** — matches one the app expects. This blocks man-in-the-middle attacks even when an attacker can get a certificate trusted by the device: a compromised or mis-issuing CA, a corporate proxy, or a user-installed profile (which is how Charles and Proxyman decrypt traffic).

Ways to implement it:

- **Info.plist (iOS 14+)**: `NSAppTransportSecurity` → **`NSPinnedDomains`** with `NSPinnedLeafIdentities` or `NSPinnedCAIdentities` (base64 SHA-256 of the SubjectPublicKeyInfo) — declarative, no code, works for URLSession and WebKit loads that use ATS.
- **`URLSessionDelegate`** `urlSession(_:didReceive:completionHandler:)`: evaluate the `SecTrust` normally first, then compare the server key's hash with your pins.
- Libraries: TrustKit, Alamofire's `ServerTrustManager`.

Operational risks — these are what interviewers want to hear:

- **Pin the public key (SPKI), not the whole certificate**, so routine renewals with the same key don't break the app.
- **Always ship a backup pin** (next key or intermediate CA); if the server rotates keys and all pins mismatch, every installed version stops working until users update.
- Coordinate with the backend team, and consider a remote kill switch.
- Pinning makes debugging with proxies harder — disable it in debug builds only.
- It's not a defense against a compromised device; attackers with a jailbreak can bypass it.

```swift
// URLSessionDelegate public-key pinning (simplified)
func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
  guard let trust = challenge.protectionSpace.serverTrust,
        SecTrustEvaluateWithError(trust, nil),                    // normal validation first
        let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
        let key = chain.first.flatMap(SecCertificateCopyKey),
        let keyData = SecKeyCopyExternalRepresentation(key, nil) as Data?,
        pinnedKeyHashes.contains(sha256Base64(keyData)) else {   // real SPKI pins also hash the ASN.1 key header
    return completionHandler(.cancelAuthenticationChallenge, nil)
  }
  completionHandler(.useCredential, URLCredential(trust: trust))
}
```

---

### 127. What are Proxyman and Charles used for? `Intermediate`

**Short:** HTTP/HTTPS proxy tools that intercept app network traffic. Debug requests, inspect payloads, mock responses.

Charles Proxy and Proxyman are **HTTP(S) debugging proxies** for macOS. You route the Simulator's or a device's traffic through them (the Mac's proxy settings for the Simulator; Wi-Fi proxy settings for a device) and they show every request and response the app makes.

To read **HTTPS** traffic, you install and trust the tool's root certificate on the Simulator/device; the proxy then performs a deliberate man-in-the-middle, decrypting and re-encrypting traffic. (Apps with certificate pinning reject this — which is why pinning is usually disabled in debug builds.)

What you use them for:

- **Inspect** requests and responses: URLs, headers, auth tokens, bodies, status codes, timing — to verify what the app actually sends vs what the backend expects.
- **Breakpoints**: pause a request or response and edit it before it continues — test how the UI handles a 500, an empty list, or a malformed field.
- **Map Local / Map Remote**: serve a local JSON file instead of the real response, or redirect to staging — great when the backend isn't ready.
- **Throttling**: simulate slow 3G or high latency (Apple's **Network Link Conditioner** does this system-wide too).
- **Repeat / compose** requests, and export them as cURL for backend teammates.

Alternatives: Xcode's network report in Instruments (HTTP Traffic instrument), and logging `URLSessionTaskMetrics`.

---

### 128. How do you handle 401s and token refresh with concurrent requests? `Advanced`

**Short:** Funnel refresh through an actor holding a single in-flight refresh Task; other requests await it, then retry once.

When several requests get a 401 at once, each must not start its own refresh — that wastes calls and can invalidate the refresh token. Put the refresh behind an actor that stores the in-flight Task; later callers await the same task. After a successful refresh, retry the original request once; if refresh fails, log the user out. Proactively refreshing shortly before expiry avoids many 401s.

```swift
actor TokenRefresher {
  private var task: Task<String, Error>?
  func refreshedToken() async throws -> String {
    if let task { return try await task.value }
    let t = Task { try await api.refreshToken() }
    task = t
    defer { task = nil }
    return try await t.value
  }
}
```

---

### 129. How should a client retry failed requests? `Intermediate`

**Short:** Retry only idempotent requests and transient errors (timeouts, 5xx, 429), with exponential backoff plus jitter and a cap.

Retrying blindly can **duplicate side effects** (charging a card twice) and **hammer a struggling server** (a thundering herd that keeps it down). A good retry policy:

1. **Retry only idempotent requests** — GET, PUT, DELETE, or a POST that carries an **idempotency key** the server uses to dedupe.
2. **Retry only transient failures** — timeouts (`URLError.timedOut`), lost connections (`.networkConnectionLost`, `.notConnectedToInternet` after connectivity returns), HTTP **5xx**, and **429 Too Many Requests**. Never retry 4xx client errors like 400, 401 (refresh the token instead — Q128), 403 or 404, or decoding errors.
3. **Exponential backoff** — wait 1 s, 2 s, 4 s… between attempts, so load on the server drops off.
4. **Jitter** — add randomness to each delay so thousands of clients don't retry in sync.
5. **Respect `Retry-After`** on 429/503 when the server sends it.
6. **Cap** the number of attempts and the total time, and stop on **cancellation**.

For offline scenarios, `URLSessionConfiguration.waitsForConnectivity` lets a request wait for the network instead of failing immediately, and user-initiated retries (a "Try again" button) often beat silent automatic ones.

```swift
func sendWithRetry(_ request: URLRequest, maxAttempts: Int = 3) async throws -> Data {
  var attempt = 0
  while true {
    do {
      return try await send(request)
    } catch let error where isTransient(error) && attempt < maxAttempts - 1 {
      let delay = pow(2, Double(attempt)) + .random(in: 0...0.5)  // backoff + jitter
      try await Task.sleep(for: .seconds(delay))                  // throws if cancelled
      attempt += 1
    }
  }
}
```

---

### 130. How does HTTP caching work with URLSession? `Intermediate`

**Short:** URLCache stores responses per Cache-Control; with ETag/Last-Modified it revalidates and reuses the body on 304 Not Modified.

`URLSession` checks a `URLCache` before going to the network. With the default request cache policy **`.useProtocolCachePolicy`**, it follows standard HTTP caching rules from the server's response headers:

- **`Cache-Control: max-age=N`** / `Expires` — the response is **fresh** for N seconds and served straight from cache, with no request at all. `no-store` prevents caching; `no-cache` means "store, but revalidate every time"; `private` is fine for a single-user client cache.
- When a cached response is **stale** and has validators — an **`ETag`** or **`Last-Modified`** header — URLSession sends a **conditional request** with `If-None-Match` / `If-Modified-Since`. If nothing changed, the server replies **`304 Not Modified`** with no body, and URLSession returns the cached body to you **as a 200** — your code doesn't see the difference, but bandwidth is saved.

Other request policies: `.reloadIgnoringLocalCacheData` (always network), `.returnCacheDataElseLoad` (offline-first, ignores freshness), `.returnCacheDataDontLoad` (cache only).

Practical notes: the default `URLCache.shared` is small, so set your own capacities early in launch (or per session via `configuration.urlCache`); responses larger than about 5% of the disk capacity aren't cached; only cacheable methods (GET) are cached; and an HTTP cache is not a substitute for an app database when you need offline data or queries.

```swift
URLCache.shared = URLCache(memoryCapacity: 20 * 1024 * 1024,
                           diskCapacity: 200 * 1024 * 1024)

var request = URLRequest(url: url)
request.cachePolicy = .useProtocolCachePolicy          // honor Cache-Control / ETag

var offline = URLRequest(url: url)
offline.cachePolicy = .returnCacheDataElseLoad         // show cached data when possible
```

---

### 131. How do background URLSession transfers behave? `Intermediate`

**Short:** Run in a system daemon and continue while suspended or after the system kills the app — but are cancelled if the user force-quits.

Create the session with `URLSessionConfiguration.background(withIdentifier:)`. The system then performs the transfers in a **separate process**, so they continue while your app is suspended and even if the **system terminates** it.

How it behaves:

- Only **download tasks** and **upload tasks from a file** are supported (no upload from `Data`, no data tasks), and you get results through **delegate callbacks**, not completion handlers or async/await results.
- When transfers finish while the app isn't running, iOS **relaunches the app in the background** and calls `application(_:handleEventsForBackgroundURLSession:completionHandler:)`. Recreate the session with the **same identifier**, let the delegate handle events, and call the stored completion handler from `urlSessionDidFinishEvents(forBackgroundURLSession:)` so the system can take an updated snapshot and suspend you again.
- In `urlSession(_:downloadTask:didFinishDownloadingTo:)`, **move the file immediately** — the temporary file is deleted when the method returns.
- If the **user force-quits** the app from the app switcher, the system **cancels all the session's background transfers** and won't relaunch the app automatically; the user must open it again.
- `isDiscretionary = true` lets the system wait for good conditions (Wi-Fi, power) — recommended for large transfers; background transfers from a backgrounded app may be scheduled discretionarily anyway.
- `sessionSendsLaunchEvents` controls whether completion wakes the app.

---

### 132. How do you make a network layer testable? `Intermediate`

**Short:** Depend on a small transport protocol that URLSession conforms to, and inject a stub that returns fixture data.

The goal is to test request building, decoding and error handling **without hitting the real network** — fast, deterministic, offline tests.

Approach 1 — **protocol seam**: depend on a tiny protocol with the one method you use. `URLSession` already has `data(for:)`, so it conforms with an empty extension. Production code injects `URLSession`; tests inject a stub that returns fixture data and a chosen status code, or throws `URLError(.notConnectedToInternet)`. A **spy** variant also records the `URLRequest` it received so you can assert on the URL, method, headers and body.

Approach 2 — **`URLProtocol` subclass**: register a custom protocol on an ephemeral `URLSessionConfiguration` (`protocolClasses = [MockURLProtocol.self]`); it intercepts every request and returns canned responses. This tests the real `URLSession` path (including your configuration) without changing production types.

What to test: decoding against **fixture JSON files** copied from real responses; error mapping for 401, 404, 500 and malformed JSON; request construction (path, query items, auth header); retry and token-refresh logic. Keep a small number of separate **integration tests** against a staging server for contract drift.

```swift
protocol HTTPTransport: Sendable {
  func data(for request: URLRequest) async throws -> (Data, URLResponse)
}
extension URLSession: HTTPTransport {}            // already has data(for:)

final class SpyTransport: HTTPTransport, @unchecked Sendable {
  var lastRequest: URLRequest?
  let body: Data, status: Int
  init(body: Data, status: Int = 200) { self.body = body; self.status = status }

  func data(for request: URLRequest) async throws -> (Data, URLResponse) {
    lastRequest = request
    let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
    return (body, response)
  }
}

@Test func mapsUnauthorized() async {
  let api = APIClient(transport: SpyTransport(body: Data(), status: 401))
  await #expect(throws: APIError.unauthorized) { try await api.profile() }
}
```

---

## Persistence (8)

### 133. What is Core Data? What are its key concepts? `Intermediate`

**Short:** Object-graph persistence framework. NSManagedObject, NSManagedObjectContext, NSPersistentStoreCoordinator.

Core Data is Apple's **object-graph management and persistence framework** — not a database itself, but a layer that manages model objects, their relationships and changes, and saves them to a store (usually **SQLite**; also in-memory or binary).

Key pieces:

- **Managed object model** (`.xcdatamodeld`) — entities, attributes, relationships, delete rules (nullify, cascade, deny).
- **`NSManagedObject`** — instances of entities (your model objects).
- **`NSManagedObjectContext`** — an in-memory **scratchpad**: you fetch, create, modify and delete objects in it, and nothing is persisted until you call `save()`. It tracks changes, supports undo, and is **bound to one queue** (Q138).
- **`NSPersistentStoreCoordinator`** — connects contexts to the persistent store(s).
- **`NSPersistentContainer`** — sets the whole stack up in a few lines (`viewContext` for the UI, `newBackgroundContext()` for work). `NSPersistentCloudKitContainer` adds iCloud sync.
- **`NSFetchRequest`** — queries with `NSPredicate`, sort descriptors, batch sizes, fetch limits.
- **`NSFetchedResultsController`** — drives table/collection views and reports changes.

Features to mention: **faulting** (objects are loaded lazily, so large graphs stay cheap), **lightweight and staged migrations** between model versions, batch insert/update/delete that bypass the context for performance, and persistent history tracking for syncing changes between processes (app + extensions). SwiftData (Q134) is built on top of it.

```swift
let container = NSPersistentContainer(name: "Model")
container.loadPersistentStores { _, error in
  if let error { fatalError("Store failed: \(error)") }
}
let context = container.viewContext
context.automaticallyMergesChangesFromParent = true

let request = NSFetchRequest<Item>(entityName: "Item")
request.predicate = NSPredicate(format: "isDone == NO")
request.sortDescriptors = [NSSortDescriptor(keyPath: \Item.createdAt, ascending: false)]
let items = try context.fetch(request)
```

---

### 134. Difference between SwiftData and Core Data? `Intermediate`

**Short:** SwiftData (iOS 17+): @Model classes, Swift-native, built on Core Data's store. Core Data: mature, every iOS version.

SwiftData (iOS 17+) is a Swift-first persistence framework that uses Core Data's storage underneath. Models are plain classes marked @Model; a ModelContainer holds the schema and store, and a ModelContext tracks changes (the main context autosaves by default). In SwiftUI, @Query fetches and observes results automatically. Core Data (available since iOS 3) is more mature: fetched results controllers, fine-grained migrations, batch operations, NSPersistentCloudKitContainer. Choose SwiftData for new iOS 17+ apps with simple schemas; Core Data for older deployment targets or advanced needs.

```swift
@Model final class Item {
  var name: String
  var date: Date
  init(name: String, date: Date = .now) { self.name = name; self.date = date }
}
// In a view: @Query(sort: \Item.date) var items: [Item]
```

---

### 135. What is UserDefaults and what should it NOT be used for? `Basic`

**Short:** Key-value plist store for small preferences. Not for sensitive data, large objects, or relational data.

`UserDefaults` is a simple **key-value store** for small values: `Bool`, `Int`, `Double`, `String`, `Date`, `Data`, `URL`, and arrays/dictionaries of those (property-list types). It's persisted to a plist in the app's container and **loaded into memory** when the app starts. Calling `synchronize()` is unnecessary today.

Good uses: user preferences (theme, sort order), feature flags, onboarding-completed and "last opened tab" state, small caches of IDs. In SwiftUI, `@AppStorage("key")` reads and writes it reactively; use `UserDefaults(suiteName: "group.…")` to share values with extensions via an App Group.

What **not** to use it for:

- **Secrets** — tokens, passwords, keys, PII. It's an unencrypted plist, readable from device backups and on jailbroken devices. Use the **Keychain** (Q137).
- **Large data** — images, big JSON, files. It's loaded into memory and rewritten as a whole, which slows launch and wastes memory. Use the file system.
- **Structured or relational data** that you query, sort or update incrementally — use SwiftData, Core Data or SQLite.
- **Data that must not be lost** — it's not transactional.

Also: `UserDefaults` is one of Apple's **required-reason APIs**, so your privacy manifest must declare why you use it (Q164). Storing `Codable` types as encoded `Data` is fine for small values.

```swift
UserDefaults.standard.set(true, forKey: "hasSeenOnboarding")
let seen = UserDefaults.standard.bool(forKey: "hasSeenOnboarding")

struct SettingsView: View {
  @AppStorage("sortOrder") private var sortOrder = "date"   // reactive
  var body: some View {
    Picker("Sort", selection: $sortOrder) { Text("Date").tag("date"); Text("Name").tag("name") }
  }
}
```

---

### 136. How do you choose where to persist data on iOS? `Basic`

**Short:** UserDefaults: small prefs. Keychain: secrets. Files: blobs and caches. SwiftData/Core Data/SQLite: queryable structured data.

UserDefaults for small settings and flags. Keychain for tokens, passwords and keys. The file system for images, JSON and large blobs — Documents for user-created data, Application Support for app data, Caches for anything re-downloadable (the system may purge it). A database — SwiftData, Core Data, or SQLite via a library like GRDB — for structured, queryable, relational data. CloudKit or your own backend when data must sync across devices.

---

### 137. Where and how should you store an auth token? `Intermediate`

**Short:** Keychain with a deliberate accessibility class, e.g. AfterFirstUnlockThisDeviceOnly — never UserDefaults or a plist.

Store tokens in the Keychain and choose the accessibility class on purpose: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly lets background refreshes read it after the first unlock and keeps it out of backups restored to other devices; WhenUnlockedThisDeviceOnly is stricter. Keep the access token in memory while running, refresh it with a refresh token, and delete Keychain items on logout. UserDefaults is an unencrypted plist in the app container, readable from backups and on jailbroken devices.

```swift
let query: [String: Any] = [
  kSecClass as String: kSecClassGenericPassword,
  kSecAttrAccount as String: "authToken",
  kSecValueData as String: Data(token.utf8),
  kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
]
let status = SecItemAdd(query as CFDictionary, nil)
```

---

### 138. What are the threading rules for Core Data? `Advanced`

**Short:** Each context is confined to its queue: use perform. Managed objects aren't thread-safe — pass NSManagedObjectID between contexts.

Every NSManagedObjectContext is bound to a queue: viewContext to the main queue, background contexts to private queues. All access to a context and its objects must happen inside perform { } (or on main for viewContext). Pass NSManagedObjectID values across contexts and re-fetch with existingObject(with:). Do heavy imports on newBackgroundContext() and set viewContext.automaticallyMergesChangesFromParent = true. The launch argument -com.apple.CoreData.ConcurrencyDebug 1 catches violations.

```swift
let bg = container.newBackgroundContext()
try await bg.perform {
  let item = Item(context: bg)
  item.name = "Imported"
  try bg.save()
}
```

---

### 139. What is @ModelActor in SwiftData? `Advanced`

**Short:** Macro generating an actor with its own ModelContext, so SwiftData work runs off the main actor safely.

SwiftData's `ModelContext` is **not `Sendable`**, and model objects (`@Model` instances) belong to the context that fetched them — you can't pass them between threads or actors. Doing heavy work (importing thousands of records, large queries) on the main context blocks the UI.

`@ModelActor` (iOS 17) is a macro you apply to an `actor`. It generates:

- a `modelContainer` property and an `init(modelContainer:)`,
- a `modelExecutor` and a **`modelContext`** created from the container and bound to the actor's own serial executor,

so everything inside the actor uses its own context safely, off the main actor.

How to use it:

- Create it with the shared `ModelContainer` (`Importer(modelContainer: container)`); the container **is** `Sendable`.
- Do inserts, fetches and saves inside actor methods, and call `try modelContext.save()` — the main context will see the changes once saved (SwiftUI's `@Query` updates automatically).
- Pass **`PersistentIdentifier`** values (which are `Sendable`) across the boundary instead of model objects, then re-fetch with `modelContext.model(for:)` or `self[id, as: Item.self]` on the other side.

This mirrors Core Data's rule of using background contexts and passing `NSManagedObjectID`s (Q138).

```swift
@ModelActor
actor Importer {
  func importItems(_ names: [String]) throws -> [PersistentIdentifier] {
    let items = names.map { Item(name: $0) }
    items.forEach { modelContext.insert($0) }
    try modelContext.save()
    return items.map(\.persistentModelID)        // Sendable IDs, not models
  }
}

let importer = Importer(modelContainer: container)
let ids = try await importer.importItems(names)
```

---

### 140. How do you design offline-first data with sync? `Advanced`

**Short:** Local DB is the source of truth; queue writes in an outbox; pull with change tokens; resolve conflicts; tombstone deletes.

The UI reads only from the local database, so it works offline and updates reactively. User edits are written locally and appended to an outbox that a sync engine flushes when connectivity returns, with retries and idempotency keys. Pull changes since a server-provided change token or cursor. Resolve conflicts with an explicit policy — last-writer-wins on server timestamps, field-level merge, or asking the user. Represent deletes as tombstones so they propagate instead of records reappearing.

---

## Testing (7)

### 141. Difference between unit testing and UI testing? `Basic`

**Short:** Unit: components in isolation with mocks, fast. UI testing: drives the full app like a user (XCUITest), slow.

**Unit tests** check one unit — a function, view model, parser or service — **in isolation**, with dependencies replaced by test doubles. They run in-process in milliseconds, need no UI, are deterministic, and pinpoint exactly what broke. Written with XCTest or Swift Testing.

**UI tests** (XCUITest) launch the **real app** in a separate process and drive it like a user — taps, typing, swipes — finding elements through the accessibility tree. They verify full flows (login → home → checkout) including navigation, layout and integration between components. They're slow (seconds per test), more **flaky** (timing, animations, network), and failures say "something in this flow broke" rather than where.

In between sit **integration tests** (several real components together, e.g. repository + in-memory database) and **snapshot tests** (Q145).

How to balance them — the **testing pyramid**: many unit tests, fewer integration tests, a handful of UI tests for the critical user journeys. Make UI tests reliable by stubbing the network via launch arguments/environment, disabling animations, using stable accessibility identifiers, and waiting for elements instead of sleeping.

---

### 142. What is TDD (Test-Driven Development)? `Intermediate`

**Short:** Write failing test first, then minimal code to pass, then refactor. Red-Green-Refactor cycle.

**Test-Driven Development** is a workflow where tests drive the design, in short cycles:

1. **Red** — write a small test for the next behavior you need; run it and watch it **fail** (proving the test can fail and the behavior doesn't exist yet).
2. **Green** — write the **simplest** code that makes it pass — even naive code.
3. **Refactor** — clean up the implementation and tests (naming, duplication, structure) while all tests stay green.

Then repeat with the next behavior.

Why teams use it: you design the API from the caller's point of view, code ends up testable by construction (injected dependencies, small units), you get a regression suite as a by-product, and bugs are caught minutes after they're written. A bug fix in TDD starts with a failing test that reproduces the bug.

Where it fits in iOS: excellent for view models, formatters, parsers, validation, business rules and networking layers; less natural for exploratory UI layout, where snapshot or UI tests come later.

Honest trade-offs: it feels slower at first, it requires discipline, and tests tied to implementation details make refactoring painful — test **behavior**, not private steps.

```swift
// 1. Red: the behavior doesn't exist yet
@Test func rejectsShortPasswords() {
  #expect(PasswordValidator().validate("abc") == .tooShort)
}

// 2. Green: simplest implementation
struct PasswordValidator {
  enum Result: Equatable { case ok, tooShort }
  func validate(_ s: String) -> Result { s.count < 8 ? .tooShort : .ok }
}
// 3. Refactor, then write the next failing test (e.g. requires a digit)
```

---

### 143. What is mocking? What types of test doubles exist? `Intermediate`

**Short:** Replacing real dependencies with controlled test objects. Types: stub, mock, fake, spy.

Mocking replaces real dependencies with controlled test doubles. Types: Stub (returns predetermined values), Mock (also verifies specific calls were made), Fake (a simplified working implementation like an in-memory DB), Spy (records calls for later assertions). In Swift, depend on protocols and inject a test conformer. Neither XCTest nor Swift Testing generates mocks — write them by hand or use a macro/codegen library.

```swift
protocol APIService { func fetchUser() async throws -> User }
class MockAPI: APIService {
  var result: User = .preview
  func fetchUser() async throws -> User { result }
}
```

---

### 144. What is XCUITest? `Basic`

**Short:** Apple's UI testing framework. Drives the full app. Finds elements via accessibility identifiers.

**XCUITest** is Apple's UI testing framework, part of XCTest. A UI test target runs in a **separate process** from your app: it launches the app with `XCUIApplication`, then interacts with it only through the **accessibility hierarchy** — it can't call your code or read your objects directly (black-box testing).

Core API:

- `XCUIApplication()` — `launch()`, `launchArguments`, `launchEnvironment` (use these to point the app at mock data, reset state, disable animations).
- **Queries** — `app.buttons["Login"]`, `app.textFields["email"]`, `app.cells.element(boundBy: 0)`, `.staticTexts`, `.navigationBars`, matched by accessibility **identifier** or label.
- **Actions** — `tap()`, `typeText(_:)`, `swipeUp()`, `press(forDuration:)`.
- **Waiting** — `waitForExistence(timeout:)` or `XCTNSPredicateExpectation`, never `sleep()`.
- Handling system alerts with `addUIInterruptionMonitor`; screenshots and `XCTAttachment` for failures; Xcode's **UI test recording** to generate a first draft.

Best practices: set stable `accessibilityIdentifier`s (not localized text), make tests independent and order-free, stub the backend, wrap screens in the **Page Object** pattern so selectors live in one place, and keep the suite small. It also powers `performAccessibilityAudit()` (Xcode 15) and launch-time measurement with `XCTApplicationLaunchMetric`. Note: Swift Testing doesn't support UI tests — they remain XCTest.

```swift
final class LoginUITests: XCTestCase {
  func testLoginShowsWelcome() {
    let app = XCUIApplication()
    app.launchArguments = ["-uiTesting", "-mockNetwork"]
    app.launch()

    let login = LoginScreen(app: app)           // page object
    login.email.tap(); login.email.typeText("a@b.com")
    login.password.tap(); login.password.typeText("secret123")
    login.submit.tap()

    XCTAssertTrue(app.staticTexts["welcomeTitle"].waitForExistence(timeout: 5))
  }
}
```

---

### 145. What is snapshot testing? `Advanced`

**Short:** Records a rendered view as reference image. Future runs compare pixel-for-pixel. Fails on visual regressions.

**Snapshot testing** renders a view or view controller, saves the result as a **reference** (usually a PNG image; text formats like a view-hierarchy dump also exist), and on later runs re-renders and **compares** against that reference. Any visual difference — spacing, color, font, truncation, a missing element — fails the test, and the tool writes the failed and diff images for review.

Libraries: **SnapshotTesting** (Point-Free) — supports many strategies (`.image`, `.recursiveDescription`, `.dump`, JSON) for UIKit and SwiftUI; **iOSSnapshotTestCase** (originally Facebook's FBSnapshotTestCase, now maintained by Uber).

Workflow: run once in **record mode** to create references, commit them, and re-record deliberately when a design change is intended — reviewers then see image diffs in the pull request.

Strengths: catches visual regressions unit tests can't see, and covers many states cheaply — light/dark mode, Dynamic Type sizes (including accessibility sizes), right-to-left languages, small and large devices, loading/empty/error states.

Drawbacks: references depend on the **simulator model, OS version and rendering**, so CI must use the same environment; tiny anti-aliasing differences need a tolerance (`precision`/`perceptualPrecision`); image files bloat the repository; and tests can be "blindly re-recorded", hiding real bugs.

```swift
import SnapshotTesting
import XCTest

final class ProfileCardSnapshotTests: XCTestCase {
  func testProfileCard() {
    let view = ProfileCard(user: .fixture).frame(width: 375)
    assertSnapshot(of: view, as: .image(layout: .sizeThatFits,
                                        traits: .init(userInterfaceStyle: .dark)))
  }
}
```

---

### 146. Swift Testing vs XCTest — key differences? `Intermediate`

**Short:** @Test functions, #expect (records, continues) and #require (throws, stops), parameterized arguments, traits, parallel by default.

**Swift Testing** (`import Testing`, shipped with Xcode 16 / Swift 6, open source) is Apple's modern unit-testing library. Main differences from XCTest:

- **Declaring tests:** any function marked **`@Test`** (global, or inside a `struct`, `actor` or class), with an optional display name. No `test` prefix or `XCTestCase` subclass. Each test gets a **fresh instance** of its suite, so `init`/`deinit` replace `setUp`/`tearDown`.
- **Assertions:** one macro, **`#expect(expression)`**, replaces the 40+ `XCTAssert...` functions and shows the values of sub-expressions on failure. **`#expect`** records the failure and **continues**; **`try #require(...)`** throws and **stops** the test — and also **unwraps optionals** (`let user = try #require(optionalUser)`). Errors: `#expect(throws: MyError.self) { ... }`.
- **Parameterized tests:** `@Test(arguments: [...])` runs the test once per input (or over zipped collections), each reported separately.
- **Traits:** `.tags(...)`, `.disabled("reason")`, `.enabled(if:)`, `.timeLimit(...)`, `.bug("url")`, `.serialized`.
- **Parallel by default**, including in-process parallelism across tests — so tests must not share mutable state; use `.serialized` where needed.
- **Async:** tests can be `async`; use `confirmation()` to verify events happen (instead of `XCTestExpectation`). Exit tests check code that crashes (`#expect(processExitsWith:)`).
- **Swift 6.3** added `Issue.record(..., severity: .warning)` (report without failing) and `try Test.cancel()` to cancel a running test.

XCTest is still needed for **UI tests** (XCUITest) and **performance tests** (`measure`). Both frameworks can live in the same target, so migrate gradually.

```swift
import Testing

@Suite("Parsing") struct ParserTests {
  let parser = Parser()                         // fresh instance per test

  @Test("Parses valid input", arguments: ["1", "42", "007"])
  func parses(_ input: String) throws {
    let n = try #require(parser.number(input))  // unwrap or stop
    #expect(n > 0)
  }

  @Test(.tags(.critical)) func rejectsEmpty() {
    #expect(throws: ParseError.empty) { try parser.strictNumber("") }
  }
}
```

---

### 147. How do you unit test an async view model? `Intermediate`

**Short:** Inject protocol dependencies (stub API or repository), await the async method, then assert on the resulting state.

Make the view model depend on protocols and inject stubs that return fixtures or throw errors. Mark the test @MainActor if the view model is main-actor isolated, call the async method with await, and assert on the published state — loading, loaded, failed. Avoid sleeps: if work is fired off internally in an unstructured Task, expose it or make the method async so the test can await it.

```swift
@MainActor @Test func loadsUser() async {
  let vm = ProfileVM(api: StubAPI(user: .fixture))
  await vm.load()
  #expect(vm.state == .loaded(.fixture))
}
```

---

## Performance (8)

### 148. Which Instruments template do you use for which problem? `Intermediate`

**Short:** Time Profiler: CPU. Hangs/Animation Hitches: jank. Allocations/Leaks: memory. Plus SwiftUI, Network and Energy templates.

Time Profiler samples call stacks to find CPU hot spots. Hangs and Animation Hitches show main-thread stalls and missed frames. Allocations tracks memory growth (Mark Generation shows what's left after repeating an action); Leaks finds unreachable cycles. The SwiftUI template shows body evaluations and their causes; Network and Energy cover traffic and battery. Always profile a Release build on a real device — Debug builds and the Simulator behave very differently.

---

### 149. How do you measure and improve app launch time? `Intermediate`

**Short:** Measure with the App Launch template and MetricKit. Cut pre-main (dylibs, static init) and post-main work before first frame.

Launch has two phases:

- **Pre-main** (before `main()`): the dynamic linker loads and binds **dynamic frameworks**, the runtime registers Objective-C classes, and **static initializers** and `+load` methods run.
- **Post-main**: `UIApplication` and the app delegate are created, `didFinishLaunching` and scene connection run, the root view controller loads, and the **first frame** is rendered. **Extended launch** — loading real content — follows.

Apple's target (WWDC19 "Optimizing App Launch"): **render the first frame within about 400 ms** — roughly 100 ms of system work plus about 300 ms for your app — so the app is responsive by the end of the launch animation. The first frame can use placeholders for content that loads asynchronously.

How to improve:

- **Fewer dynamic frameworks** — merge them or link statically (Xcode 15's **mergeable libraries** help); avoid many CocoaPods dynamic frameworks.
- **Remove `+load` and expensive static initializers**; make singletons lazy.
- **Defer non-essential work** — analytics, ads, remote config, non-critical SDKs — until after the first frame, or do it lazily on first use.
- **No synchronous I/O or network on the main thread** at launch; don't block on a remote config fetch.
- **Simplify the first screen** — fewer views, no giant storyboards, cached data instead of waiting for the network.

Measure, don't guess: the **App Launch** template in Instruments, `XCTApplicationLaunchMetric` in performance tests, **MetricKit** and the **Xcode Organizer** launch-time metrics from real users. Test on a real device, Release build, after a reboot for cold launch numbers.

---

### 150. What is the frame budget, and what causes a hitch? `Basic`

**Short:** 60 Hz ≈ 16.7 ms per frame, 120 Hz ProMotion ≈ 8.3 ms. Main-thread work beyond that drops frames.

The display refreshes 60 times per second (120 on ProMotion), so each frame must be produced in about 16.7 ms (8.3 ms), and the render server needs part of that time. Layout, SwiftUI body evaluation, text measurement, image decoding and any synchronous work on the main thread all count. Missing the deadline causes a hitch — a visibly dropped frame. Move work off main, cache expensive results, and decode or downsample images in the background.

---

### 151. What is offscreen rendering and how do you avoid it? `Advanced`

**Short:** The GPU must render a layer into a separate buffer first (shadows without shadowPath, masks, group opacity). Costs extra passes.

Some effects force the render server to draw a layer into an offscreen buffer before compositing: shadows without a shadowPath (the shape has to be derived from the content), mask layers, group opacity, and some corner-radius clipping of content. In scrolling lists this burns GPU time and causes hitches. Fixes: set layer.shadowPath explicitly, avoid masks where a simple cornerRadius works, pre-render rounded images, and use shouldRasterize only for static complex content. The Simulator's Color Off-screen Rendered option highlights offenders.

```swift
card.layer.shadowOpacity = 0.2
card.layer.shadowRadius = 8
card.layer.shadowPath = UIBezierPath(
  roundedRect: card.bounds, cornerRadius: 12).cgPath
```

---

### 152. What is a jetsam event? `Intermediate`

**Short:** iOS terminates apps exceeding memory limits. No exception in your code — it looks like a silent crash. Reduce peak memory.

When memory runs low, iOS's jetsam mechanism terminates processes — background apps first, but a foreground app is killed if it exceeds its own memory limit. Your code gets no exception, so it often looks like a mysterious crash; check memory terminations in the Xcode Organizer, MetricKit, or JetsamEvent logs on the device. Reduce peak footprint: downsample images, use NSCache (evicts under memory pressure), respond to memory warnings, and stream large files instead of loading them fully.

---

### 153. Why and how do you downsample images? `Intermediate`

**Short:** Decoded size = width × height × 4 bytes, regardless of file size. Decode at display size with ImageIO thumbnails.

A 4000×3000 photo decodes to about 48 MB of pixels even if the JPEG is 2 MB and the image view is 100 pt wide. Use ImageIO's CGImageSourceCreateThumbnailAtIndex with kCGImageSourceThumbnailMaxPixelSize set to display size × screen scale to decode only what you need, off the main thread — or UIImage.preparingThumbnail(of:) on iOS 15+. Cache the results in NSCache plus a disk cache.

```swift
let opts = [kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels] as CFDictionary
guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
      let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts) else { return nil }
return UIImage(cgImage: cg)
```

---

### 154. How do you find out why a SwiftUI view keeps re-evaluating? `Intermediate`

**Short:** Call Self._printChanges() in body (debug only) and use the SwiftUI Instruments template to see what triggered updates.

let _ = Self._printChanges() inside body logs what caused each evaluation: @self (the view's inputs changed), @identity (the view was recreated), or a property name such as _model. SwiftUI compares a child view's stored inputs and skips its body when they are unchanged, so extra evaluations usually come from inputs that change every time — closures, freshly created objects, or broad ObservableObject publishes. Fixes: pass smaller values, adopt @Observable, keep heavy work out of body. _printChanges is an underscored API — debug builds only.

```swift
var body: some View {
  let _ = Self._printChanges()
  Text(model.title)
}
```

---

### 155. How do you monitor performance in production? `Advanced`

**Short:** MetricKit delivers daily metrics and diagnostics (hangs, crashes, launch, memory); Xcode Organizer aggregates them.

An MXMetricManager subscriber receives MXMetricPayload about once a day (launch time, hang rate, memory, CPU, disk writes) and MXDiagnosticPayload with call stacks for crashes, hangs, CPU exceptions and disk-write exceptions (delivered immediately since iOS 15). The Xcode Organizer shows aggregated metrics from users who share analytics. Add signposts with OSSignposter around key operations to measure them in Instruments and in your own telemetry.

---

## Security & Tools (10)

### 156. What is the Keychain? When should you use it over UserDefaults? `Basic`

**Short:** OS-managed encrypted storage for secrets: tokens, passwords, keys. Never store those in UserDefaults.

The Keychain is a secure, OS-managed encrypted store. Unlike UserDefaults (an unencrypted plist in the app container), items are encrypted with keys protected by the Secure Enclave and the device passcode, and access is controlled by accessibility classes. Items can be shared between your apps via Keychain Sharing. Items have historically survived app deletion, but Apple doesn't guarantee it — don't rely on it, and clear stale items on first launch if that matters. Use the Keychain for auth tokens, passwords, private keys and biometric-protected secrets.

---

### 157. What are the different iOS app states? `Basic`

**Short:** Not Running → Inactive → Active → Background → Suspended. Handle in AppDelegate or scenePhase.

iOS app (process) states:

- **Not running** — not launched, or terminated (by the user or the system).
- **Inactive** — in the foreground but **not receiving events**: briefly during launch and transitions, and while interrupted (incoming call sheet, Control Center pulled down, the app switcher).
- **Active** — foreground and receiving events: normal use.
- **Background** — not visible but **executing code**: for a short time after leaving the foreground (finish work with `beginBackgroundTask`), or longer for supported modes (audio, location, VoIP, background fetch/processing via `BGTaskScheduler`, background URLSession).
- **Suspended** — in memory but **not executing**. The system moves apps here automatically, and may **terminate suspended apps without notice** to reclaim memory — so save state when entering the background, not in `applicationWillTerminate`, which usually isn't called.

With the **scene-based lifecycle**, each scene has its own state (unattached, foreground inactive, foreground active, background) reported to its `UISceneDelegate` (`sceneDidBecomeActive`, `sceneDidEnterBackground`, …), while the process-level states still apply to the app as a whole. Apple's TN3187 says scene adoption becomes **required** for apps built with the SDK released after iOS 26 (Q40). In SwiftUI, observe `@Environment(\.scenePhase)` (`.active`, `.inactive`, `.background`).

```swift
struct ContentView: View {
  @Environment(\.scenePhase) private var phase
  var body: some View {
    MainView()
      .onChange(of: phase) { _, newPhase in
        if newPhase == .background { saveDraft() }   // may be suspended/killed soon
      }
  }
}
```

---

### 158. What is APNS and how does push notification delivery work? `Intermediate`

**Short:** Apple Push Notification service. App registers → gets device token → server sends payload to APNs → APNs delivers.

Flow: 1) The app calls registerForRemoteNotifications and receives a device token. 2) The app sends the token to your server. 3) Your server sends a JSON payload to APNs over HTTP/2, authenticating with a token (JWT signed by a .p8 key) or a certificate. 4) APNs delivers to the device. The payload's aps dictionary holds alert, badge and sound plus custom data. Background pushes (content-available: 1) can wake the app without showing anything, but delivery is throttled and not guaranteed.

---

### 159. Difference between URL Schemes and Universal Links? `Intermediate`

**Short:** URL Schemes: custom protocol, unverified, any app can intercept. Universal Links: HTTPS, domain-verified, secure.

URL Schemes (myapp://path) are custom protocol handlers registered in Info.plist. No ownership verification — any app can register the same scheme, creating a security risk. Universal Links use HTTPS URLs tied to your domain via an apple-app-site-association file (cryptographically verified by Apple). Deep links open the app if installed, fallback to Safari if not. Universal Links are preferred for security and better UX.

---

### 160. What is a symbolic breakpoint in Xcode? `Intermediate`

**Short:** Breakpoint on a method name regardless of file. Great for UIKit internals, ObjC exceptions, Auto Layout conflicts.

A **symbolic breakpoint** stops execution whenever a **named function or method** is called, no matter which file, module or framework implements it — including Apple's closed-source frameworks, where you can't set a line breakpoint. Add it from the Breakpoint navigator (**+ → Symbolic Breakpoint**), entering a symbol such as `-[UIViewController viewDidLoad]` or a Swift name like `MyApp.ProfileViewModel.load`, optionally limited to a module.

Useful symbols:

- `UIViewAlertForUnsatisfiedConstraints` — stop at Auto Layout conflicts and inspect the views involved.
- `objc_exception_throw` — stop where an Objective-C exception is thrown, before it unwinds (an **Exception Breakpoint** does this too).
- `swift_willThrow` — stop whenever any Swift error is thrown.
- `-[UIView layoutSubviews]` or `-[UIViewController dealloc]` — trace layout passes or deallocations.
- `malloc_error_break` — stop on heap corruption such as a double free.

Breakpoints can have **conditions** (`self.isKindOfClass(...)`, a counter), an **ignore count**, and **actions** — log a message, run an LLDB command (`po $arg1`), play a sound — with **"Automatically continue"**, turning them into non-intrusive logpoints without adding `print` statements. Share useful ones with the team by moving them to the **User** level or committing the shared breakpoint file.

---

### 161. How do you protect an API key shipped in an app? `Advanced`

**Short:** You can't fully — binaries and traffic can be inspected. Keep secrets on a backend proxy; use App Attest and short-lived tokens.

Anything in the app bundle can be extracted with reverse-engineering tools, and requests can be intercepted, so obfuscation only slows attackers down. Keep third-party secrets on your backend and have the app call your server, which adds the key. Authenticate users with short-lived tokens, use App Attest or DeviceCheck to verify requests come from a genuine app, and rate-limit on the server.

---

### 162. What are iOS data protection classes? `Intermediate`

**Short:** Files are encrypted with keys tied to the passcode; .complete is unreadable while locked, the default is until first unlock.

With a passcode set, file contents are encrypted with keys derived partly from it. Complete protection makes a file unreadable whenever the device is locked; completeUnlessOpen allows finishing writes to files already open; completeUntilFirstUserAuthentication (the default) is readable after the first unlock until reboot, which background tasks often need. Choose per file — stricter classes can break background access. Keychain items have equivalent accessibility classes.

```swift
try data.write(to: url, options: .completeFileProtection)
```

---

### 163. How should Face ID / Touch ID protect sensitive data? `Advanced`

**Short:** Store the secret in the Keychain with SecAccessControl (.biometryCurrentSet), not just a success boolean from LAContext.

`LAContext.evaluatePolicy(...)` returns a **Boolean in your app's process**. If your app does `if success { showSecrets() }`, an attacker on a jailbroken device can hook that call or flip the result, and the "protected" data was readable all along. Biometrics should **gate access to a secret**, not just a screen.

The secure pattern: store the secret (refresh token, encryption key, PIN-protected value) in the **Keychain** with an access-control object from `SecAccessControlCreateWithFlags`:

- **`.biometryCurrentSet`** — requires Face ID/Touch ID, and the item becomes **unusable if biometric enrollment changes** (a new face or finger added) — the strongest option.
- **`.biometryAny`** — survives enrollment changes.
- **`.userPresence`** — biometrics with passcode fallback.
- Combined with an accessibility class like `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` (the item is deleted if the passcode is removed, and never leaves the device).

When the app reads the item, the system shows the biometric prompt itself, and the **Secure Enclave releases the item only after successful authentication** — there's no boolean to bypass. For keys, you can go further and generate a **Secure Enclave private key** (`kSecAttrTokenIDSecureEnclave`) that never leaves the hardware and sign server challenges with it.

Also: add **`NSFaceIDUsageDescription`** to Info.plist (missing it crashes on Face ID devices), provide a fallback (passcode or re-login), and handle errors like `biometryLockout` and `userCancel`.

```swift
let access = SecAccessControlCreateWithFlags(nil,
  kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
  .biometryCurrentSet, nil)!

let add: [String: Any] = [
  kSecClass as String: kSecClassGenericPassword,
  kSecAttrAccount as String: "refreshToken",
  kSecValueData as String: Data(token.utf8),
  kSecAttrAccessControl as String: access
]
SecItemAdd(add as CFDictionary, nil)

// Reading triggers the system Face ID prompt; the Secure Enclave releases the data only on success.
let context = LAContext()
context.localizedReason = "Unlock your account"
let query: [String: Any] = [
  kSecClass as String: kSecClassGenericPassword,
  kSecAttrAccount as String: "refreshToken",
  kSecReturnData as String: true,
  kSecUseAuthenticationContext as String: context
]
var item: CFTypeRef?
let status = SecItemCopyMatching(query as CFDictionary, &item)
```

---

### 164. What is a privacy manifest? `Intermediate`

**Short:** PrivacyInfo.xcprivacy declares collected data, tracking domains and required-reason API usage; needed by apps and listed SDKs.

Since spring 2024, App Store submissions must declare approved reasons for 'required reason' APIs such as UserDefaults, file timestamps, system boot time and disk space, and commonly used third-party SDKs must ship their own manifests and signatures. The manifest also lists collected data types and tracking domains. Tracking across apps additionally requires App Tracking Transparency permission, and declared tracking domains are blocked until the user grants it.

---

### 165. How do you ship a risky feature safely? `Intermediate`

**Short:** Remote feature flag with a kill switch, 7-day phased release, monitoring of crashes and metrics, pause or disable if needed.

1. **Feature flag with a kill switch** — ship the code dark, behind a remotely controlled flag (Firebase Remote Config, LaunchDarkly, your own endpoint), so it can be turned off for everyone **without a new binary or App Review**. Keep the old code path working as the fallback.
2. **Gradual exposure** — enable the flag for internal users and TestFlight first, then a small percentage of production users, and increase as metrics stay healthy.
3. **App Store phased release** — for the binary itself, Apple spreads **automatic updates** over 7 days: 1%, 2%, 5%, 10%, 20%, 50%, 100%. You can **pause for up to 30 days in total** (any number of times) or release to everyone early. It only affects automatic updates — anyone can update manually from the App Store at any time, and new installs always get the new version.
4. **Monitor** — crash-free rate (Crashlytics, Xcode Organizer), MetricKit hang and launch metrics, error rates of the new endpoints, and business metrics for the flagged cohort, with alerts.
5. **React** — flip the flag off, pause the phased release, ship a fix with an expedited review if needed. You **can't roll back** an App Store binary, which is exactly why the flag matters.

Housekeeping: remove the flag and the old path once it's fully rolled out (stale flags become tech debt), and remember the **version** (`CFBundleShortVersionString`) is user-facing while the **build number** (`CFBundleVersion`) must increase with every upload. Server-driven changes need backward compatibility with old app versions still in the field.

```swift
struct FeatureFlags {
  let remote: RemoteConfig
  var newCheckout: Bool { remote.bool("new_checkout_enabled", default: false) } // safe default
}

func makeCheckout(flags: FeatureFlags) -> UIViewController {
  flags.newCheckout ? NewCheckoutViewController() : LegacyCheckoutViewController()
}
```

---

## System Design (4)

### 166. How do you structure an answer in a mobile system design interview? `Basic`

**Short:** Clarify scope, define API and data model, sketch client architecture, then deep-dive offline, caching, pagination and trade-offs.

1) Clarify functional requirements and scale and agree on scope. 2) Non-functional needs: offline, latency, battery, privacy. 3) Client–server API and data model. 4) High-level client architecture: UI, state, repository, network and persistence layers. 5) Deep dives: pagination, caching, sync, image loading, real-time updates. 6) Edge cases and failure modes. 7) Trade-offs, testing and monitoring. Explain why you choose each option rather than listing technologies.

---

### 167. Design an infinite-scroll news feed. `Intermediate`

**Short:** Cursor pagination with prefetch, local cache as source of truth, image pipeline, optimistic likes with rollback.

Use cursor-based pagination (stable when new posts are inserted, unlike offsets) and prefetch the next page before the user reaches the end. Store pages in a local database that the UI observes, so the feed opens instantly and works offline. Load images through a pipeline with memory and disk caches, downsampling, and cancellation for off-screen cells. Make likes optimistic: update the UI immediately, send the request, roll back on failure. On refresh, show a 'new posts' pill instead of shifting the user's scroll position.

---

### 168. Design a chat app client. `Advanced`

**Short:** Socket for live delivery, local DB + outbox, client message UUIDs for dedupe, server sequence numbers for ordering and gaps.

Use a WebSocket for live delivery while in the foreground and push notifications when not (a Notification Service Extension can decrypt or enrich content). Write outgoing messages to the local DB and an outbox first, show them as sending, then mark them sent on acknowledgement. A client-generated UUID makes resends idempotent so the server can dedupe retries. The server assigns a per-conversation sequence number used for ordering and gap detection — on reconnect, fetch everything after the last seen sequence. Discuss end-to-end encryption, read receipts and history pagination.

---

### 169. Design an image loading and caching library. `Intermediate`

**Short:** Memory cache → disk cache → network; dedupe in-flight requests, downsample off main, cancel when cells are reused.

Look up a decoded image in a memory cache (NSCache keyed by URL and target size), then the original data in a size-limited disk cache with LRU or age eviction, then the network. Coalesce duplicate requests for the same URL into one in-flight task. Decode and downsample off the main thread to the display size. Support cancellation when a cell is reused, prioritize visible requests, and respect HTTP cache headers where possible.

```swift
actor ImageLoader {
  private var inFlight: [URL: Task<UIImage, Error>] = [:]
  func image(for url: URL) async throws -> UIImage {
    if let task = inFlight[url] { return try await task.value }
    let task = Task { try await download(url) }
    inFlight[url] = task
    defer { inFlight[url] = nil }
    return try await task.value
  }
}
```

---

## Behavioral (5)

### 170. What is the STAR method? `Basic`

**Short:** Situation, Task, Action, Result — a concise story focused on your own actions and a measurable outcome.

**STAR** structures a behavioral answer into a short story with a clear outcome:

- **Situation** (10–15%) — just enough context: team, product, what was at stake. "Our banking app's checkout crash rate jumped right after a release."
- **Task** (10–15%) — what **you** were responsible for, and the constraint (deadline, ambiguity, conflict).
- **Action** (50–60%) — the specific steps **you** took and **why**: what you investigated, the options you weighed, who you involved, the technical decision. Say "I", not "we" — interviewers are evaluating you. This is where seniority shows.
- **Result** (15–20%) — the measurable outcome (for example: crash-free rate back above 99.5% within a day, build time cut by 40%, feature shipped two weeks early) and **what you learned** or would do differently.

Preparation: build a bank of **6–8 stories** that cover common prompts — conflict/disagreement, failure or mistake, a production incident, leading without authority, ambiguity, a tight deadline, mentoring someone, a technical decision you're proud of. One good story can be adapted to several questions. Aim for about **two minutes**, have numbers ready, don't badmouth people, and expect follow-ups ("What would you do differently?", "How did the other person react?").

---

### 171. Tell me about a technical disagreement with a teammate. `Intermediate`

**Short:** Show you listened first, used data or prototypes, disagreed respectfully, committed to the decision and kept the relationship.

Interviewers look for listening before arguing, separating the person from the idea, grounding the debate in evidence (benchmarks, prototypes, user impact), escalating only when needed, and committing once a decision is made even if it wasn't yours. Finish with the outcome and what you would repeat or change. Avoid stories where you were simply right and the other person simply wrong.

---

### 172. Describe how you handled a production incident. `Intermediate`

**Short:** Mitigate first (flag off, rollback, pause rollout), communicate, then find root cause, fix, add tests and monitoring, blameless postmortem.

Interviewers want to see **calm prioritization: stop the bleeding first, then find the root cause, then make sure it can't happen again**, plus good communication. Structure the story (STAR):

1. **Detection** — how you found out: crash-rate alert in Crashlytics/Organizer, a spike in error logs, support tickets, an App Store review wave. Faster detection is itself a lesson.
2. **Assess impact** — which versions, devices, OS versions, what percentage of users, which feature; is data being lost or money affected? This sets urgency.
3. **Mitigate** — the fastest safe action: turn the **feature flag off**, **pause the phased release**, roll back a server change, add a server-side guard, or prepare an **expedited App Review** hotfix. Explain why you chose that option.
4. **Communicate** — keep stakeholders (product, support, backend) informed with regular, factual updates; give support a workaround message.
5. **Root cause** — reproduce it, use crash logs and symbolicated stack traces, logs and metrics; ask "why" until you reach the real cause (e.g. a backend field became `null` and the app force-unwrapped it).
6. **Fix and prevent** — fix with a regression test, then add safeguards: decoding that tolerates missing fields, contract tests with the backend, better monitoring/alerts, a release checklist item.
7. **Blameless postmortem** — written timeline, causes, action items with owners; the focus is the system, not a person.

Close with the measurable result (time to mitigation, crash-free rate restored) and what you'd do differently.

---

### 173. How do you handle technical debt? `Intermediate`

**Short:** Make it visible, tie it to business impact, pay it down incrementally alongside features, prevent new debt with standards.

Track debt explicitly and quantify its cost — bugs, slower delivery, crash rates — then prioritize items that block upcoming work. Pay it down incrementally (the boy-scout rule, a share of each sprint, refactoring as part of related features) rather than with big-bang rewrites. Prevent new debt with code review, linting and tests. Show that you balance shipping with long-term sustainability.

---

### 174. What questions should you ask the interviewer? `Basic`

**Short:** Ask about planning and release process, code review, biggest technical challenges, how success is measured, onboarding.

Good questions show genuine interest: How does the team plan and release (cadence, phased rollout)? What does code review look like? What are the biggest technical challenges or debt right now? How are iOS architecture decisions made? How is success measured in the first six months? What do onboarding and mentorship look like? Avoid questions the company website already answers.

---

## Review notes & sources

### What changed in this review

- **Expanded:** every answer whose detailed explanation was under ~60 words (103 of 174) now covers the mechanism, common pitfalls, follow-up points interviewers ask about, and — where useful — a fuller code example.
- **Corrected / updated:**
  - **Q11–16:** Objective-C examples were marked as Swift code blocks; now marked `objc`.
  - **Q32:** lifecycle order aligned with Apple's documented sequence (view added and laid out, traits updated → `viewIsAppearing` → layout callbacks → `viewDidAppear`); `viewIsAppearing` confirmed as back-deployed to iOS 13.
  - **Q33:** Apple documents `frame` as *undefined* when `transform` isn't identity — use `center` and `bounds`.
  - **Q40, Q157:** added Apple's TN3187 requirement — the scene-based lifecycle becomes mandatory (apps won't launch otherwise) when building with the SDK released after iOS 26.
  - **Q46:** added iOS 26 UIKit automatic observation tracking (`updateProperties()`, `layoutSubviews()`).
  - **Q87, Q96:** added Xcode 26 defaults — MainActor default isolation for new projects and the Approachable Concurrency setting (which enables SE-0461's `nonisolated(nonsending)` behavior).
  - **Q126:** added declarative pinning with `NSPinnedDomains` (iOS 14+) and the backup-pin/key-rotation risk.
  - **Q131:** confirmed: a user force-quit cancels background transfers and the app is not relaunched automatically.
  - **Q146:** clarified what `#require` does (stops the test, unwraps optionals); added Swift 6.3 additions (`Issue.record(severity: .warning)`, `Test.cancel()`).
  - **Q149:** added Apple's breakdown of the 400 ms first-frame goal (~100 ms system + ~300 ms app).
  - **Q165:** confirmed phased-release percentages; added the 30-day total pause limit.
- Answers not listed here were checked and left as they were, apart from expansion.

### Sources used for verification

- Apple — [viewIsAppearing(_:)](https://developer.apple.com/documentation/uikit/uiviewcontroller/viewisappearing(_:))
- Apple — [TN3187: Migrating to the UIKit scene-based life cycle](https://developer.apple.com/documentation/technotes/tn3187-migrating-to-the-uikit-scene-based-life-cycle)
- Apple — [Automatic observation tracking (UIKit)](https://developer.apple.com/documentation/uikit/automatic-observation-tracking)
- Apple — [URLSessionConfiguration.background(withIdentifier:)](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/background(withidentifier:))
- Apple — [Release a version update in phases](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases)
- Apple — [Swift Testing: Expectations and confirmations](https://developer.apple.com/documentation/testing/expectations)
- Apple WWDC19 — [Optimizing App Launch](https://developer.apple.com/videos/play/wwdc2019/423/)
- Swift.org — [Swift 6.3 Released](https://swift.org/blog/swift-6.3-released/)
- Swift Forums — [SE-0461: Run nonisolated async functions on the caller's actor by default](https://forums.swift.org/t/focused-re-review-se-0461-run-nonisolated-async-functions-on-the-callers-actor-by-default/78921)
- Swift Forums — [swift-foundation now available](https://forums.swift.org/t/swift-foundation-now-available/73530)
- Donny Wals — [What is Approachable Concurrency in Xcode 26?](https://www.donnywals.com/what-is-approachable-concurrency-in-xcode-26/) and [Setting default actor isolation in Xcode 26](https://www.donnywals.com/setting-default-actor-isolation-in-xcode-26/)
- OWASP MASTG — [iOS network security / certificate pinning](https://mas.owasp.org/MASTG/knowledge/ios/MASVS-NETWORK/MASTG-KNOW-0072/)

### Good references for further study

- [The Swift Programming Language](https://docs.swift.org/swift-book/)
- [Swift Evolution proposals](https://github.com/swiftlang/swift-evolution)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)

