# Marked Types

Fix for instanceof issues.

## The Problem

Using [npm](https://npmjs.org/) packaging you can easily get into situation when `instanceof` returns false even if object is actually an instance of given type.

This may happen when some module is loaded more than once from several different locations. It is common situation because of the way npm handles dependencies.

Note, that you can run into this problem not only with npm itself, but also by using [browserify](http://browserify.org/), working different execution contexts and possibly in number of other situations.

For more information, see [problem details](./the_problem.md).

## Motivation

Most cases when you want to use instanceof are simple enough:

* You want to recognize certain type of objects

For example, you declared Option type and later want to check argument of some function to be an Option.

* You want to distinguish between number of types

For example, you declared several kinds of Exception subtypes and want to recognize which one you've catched.

For both cases it's enough to mark somehow your types of interest and later check objects on having corresponding markers. That's exactly what marked_types allows to do.

Marked types can be used in node.js and also in browser using [browserify](http://browserify.org/) or something similar.

## API

* mark(type, id) - marks specified type with given id
* is(obj, type) - checks if obj is instance of given type according to markers previously set

## Type ids

**NOTE** Type ids are always compared as whole strings for type checking purposes, without any parsing or deeper analysis. Marked types supposed to be fast, not smart. The only reason type ids have some specific format is to guarantee global uniqueness.

Type id format:

`packageName{URI}(versionSpecifier):idWithinPackage`

* `{URI}` part is optional if package is registered in [npm](https://npmjs.org/) under packageName, because this makes packageName unique enough
* `(versionSpecifier)` part is optional and can use whatever agreements you want for your package versioning
	* it's recommended to use version specifiers compatible with used by [npm](https://npmjs.org/)
* `packageName{URI}(versionSpecifier)` part can be skipped if you are sure your type inherits another marked type with fully qualified id within the same package
* `idWithinPackage` part is unique type id within your package
	* it can use semicolons to separate it's parts
	* it's recommended to use type name as idWithinPackage whenever possible
	* if you have several types with the same name, you can distinguish them by
		* using some "kind specifier" as part of idWithinPackage:
			* `(client):MyType`, `(server):MyType`
		* use path within package as part of idWithinPackage:
			* `lib/client:MyType`, `lib/server:MyType`

It's recommended to:

* Using simplest form with skipping all optional parts whenever possible
* Keep ids short but readable

Escaping:

* If any part of your id contains " " (space) characters, they must be escaped by backslash
* If packageName part contains ":" (semicolon) characters, they must be escaped by backslash
* If URI part contains "}" characters, they must be escaped by backslash
* If versionSpecifier part contains ")" characters, they must be escaped by backslash

Id examples:

* `myPkg:MyType`
* `myPkg:(server):MyType`
* `myPkg:lib/client:MyType`
* `myPkg{http://myprojectpage.com/myPkg}:(client):MyType`
* `myPkg(>=0.1.0):MyType`
* `:MyType` - only acceptable for subtypes of marked type within the same package (see above)

## Subtypes

marked_types works correctly with subtypes, because when you mark subtype of already marked type, it actually use concatenation of their markers as a marker for subtype. When type is checked, marked_types checks that marker of object starts with marker of type. This will be true for object's type and any of it's supertypes. See "Internals" below for details.

## Types Versioning

Types marked with the same id are equivalent for marked_types even if they belong to different package versions. You can use versionSpecifier part to prevent this. But also you can use versionSpecifier to state that some type can be freely used across some versions.

For example:

* Assume, we have package version 0.1.0 with type marked as `myPkg(0.1.0):MyType` within it
* Then we alter version to 0.1.1 and change type id to `myPkg(>=0.1.1):MyType`
* Then we alter version to 0.1.2 and leave type id the same
* Then we alter version to 0.2.0 and change type id to `myPkg(>=0.2.0):MyType`

Then:

* MyType types from package versions 0.1.1 and 0.1.2 will be equivalent for marked_types
* But MyType from package version 0.1.0 will not be equivalent to ones of other versions
* The same for version 0.2.0

Note, that versionSpecifier has no direct relation to your package version. For marked_types it's just part of id and have no special meaning. But you can use it to do tricks described above.

Also note, that this "versioning" can be broken by changing inheritance structure, because the way marked_types works (see "Internals" below).

## Library Usage

You can mark type when declared:

```js
var mt = require('marked_types');

var MyType = function () {
};
mt.mark(MyType, 'myPkg:MyType');
```

And then check if an object is instance of your type:

```js
var obj1 = new MyType();
mt.is(obj1, MyType); // true
mt.is(obj1, SomeOtherType); // false
```

And this will also work for inherited types:

```js
var inherits = require('util').inherits;

var MyOtherType = function () {
};
inherits(MyOtherType, MyType);

var obj2 = new MyOtherType();

mt.is(obj2, MyType); // true
// but
mt.is(obj2, MyOtherType); // false - because MyOtherType is not marked
```

If you want to be able to detect inherited type also, you should mark it too:

```js
var MyThirdType = function () {
};
inherits(MyThirdType, MyType);
mt.mark(MyThirdType, 'myPkg:MyThirdType');

var obj3 = new MyThirdType();
mt.is(obj3, MyType); // true
mt.is(obj3, MyThirdType); // true
mt.is(obj3, MyOtherType); // false
```

## Internals

Marked types attaches `typeMarker_` property to type itself and it's prototype. This way both type and it's instances will have this property.

If type have no marked supertypes, `typeMarker_` value will be set to id specified in `mark()` call.

Otherwise marker is concatenation of the marker of nearest marked supertype and id specified. Space character is used as separator for resulting ids chain.

Example:

```js
var MyType = function () {
};
mt.mark(MyType, 'myPkg:MyType');

var MyOtherType = function () {
};
inherits(MyOtherType, MyType);
mt.mark(MyOtherType, 'myPkg:MyOtherType');

MyType.typeMarker_; // "myPkg:MyType"
MyOtherType.typeMarker_; // "myPkg:MyType myPkg:MyOtherType"
```

### Types checking

`is(obj, type)` function returns true if type or it's nearest supertype has marker matching to one of obj. Markers match if marker of object is equal to marker of type or starts with it and followed by unescaped " " (space) character. Supertypes are obtained using `super_` property.

Example:

* "myPkg:MyType" marker of object **matches** "myPkg:MyType" marker of type - they are equal
* "myPkg:MyType :MyOtherType" marker of object **matches** "myPkg:MyType" marker of type - it starts with it and followed by unescaped space
* "myPkg:MyType :MyOtherType :MyOtherType2" marker of object **matches** "myPkg:MyType :MyOtherType" marker of type - it starts with it and followed by unescaped space
* "myPkg:MyType :MyOtherType" marker of object **doesn't match** "myPkg:MyType2" marker of type - it starts with it, but is not followed by unescaped space

## License

MIT
