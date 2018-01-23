/*
 *
 * https://github.com/fatlinesofcode/ngDraggable
 */
angular.module("ngDraggable", [])
    .factory("ngDragHitTest", ['$document', '$window', function($document, $window){


        var sidesHitTests = {
            "top" : function(bounds, mouseX, mouseY, distance)
            {
                return  mouseY < bounds.top + distance;
            },
            "bottom" : function(bounds, mouseX, mouseY, distance)
            {
                return mouseY > bounds.bottom - distance;
            },
            "left" : function(bounds, mouseX, mouseY, distance)
            {
                return mouseX < bounds.left + distance;
            },
            "right" : function(bounds, mouseX, mouseY, distance)
            {
                return mouseX > bounds.right - distance;
            }
        };

        var pointBoxCollision = function(bounds, mouseX, mouseY)
        {
            return  mouseX >= bounds.left
                && mouseX <= bounds.right
                && mouseY <= bounds.bottom
                && mouseY >= bounds.top;
        }

        var hitTest = function(element, mouseX, mouseY, sides) {
            var distance = distance || 0;
            if(sides && sides.hasOwnProperty("all") && sides["all"] !== null)
            {
                var distance = sides.all.distance || 10;
                sides = {
                    "left"    : {"distance" : distance},
                    "right"   : {"distance" : distance},
                    "bottom"  : {"distance" : distance},
                    "top"     : {"distance" : distance}
                };
            }

            var bounds = element.getBoundingClientRect();// ngDraggable.getPrivOffset(element);
            mouseX -= $document[0].body.scrollLeft + $document[0].documentElement.scrollLeft;
            mouseY -= $document[0].body.scrollTop + $document[0].documentElement.scrollTop;

            var isInside = pointBoxCollision(bounds, mouseX, mouseY);
            var result = {"inside" : false};
            if(isInside)
            {
                result.inside = true;
                for(var side_key in sides)
                {
                    var distance = sides[side_key].distance || 10;
                    result[side_key] = sidesHitTests[side_key](bounds, mouseX, mouseY, distance);
                }
                return result;
            }
            return result;
        };
        return hitTest;
    }])
    .service('ngDraggable', [function() {


        var scope = this;
        scope.inputEvent = function(event) {
            if (angular.isDefined(event.touches)) {
                return event.touches[0];
            }
            //Checking both is not redundent. If only check if touches isDefined, angularjs isDefnied will return error and stop the remaining scripty if event.originalEvent is not defined.
            else if (angular.isDefined(event.originalEvent) && angular.isDefined(event.originalEvent.touches)) {
                return event.originalEvent.touches[0];
            }
            return event;
        };

    }])
    .directive('ngDrag', ['$rootScope', '$parse', '$document', '$window', 'ngDraggable', 'ngDragHitTest', function ($rootScope, $parse, $document, $window, ngDraggable, ngDragHitTest) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                scope.value = attrs.ngDrag;
                var offset,_centerAnchor=false,_mx,_my,_tx,_ty,_mrx,_mry;
                var _hasTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;
                var _pressEvents = 'touchstart mousedown';
                var _moveEvents = 'touchmove mousemove';
                var _releaseEvents = 'touchend mouseup';
                var _dragHandle;

                // to identify the element in order to prevent getting superflous events when a single element has both drag and drop directives on it.
                var _myid = scope.$id;
                var _data = null;

                var _dragOffset = null;

                var _dragEnabled = false;

                var _pressTimer = null;

                var onDragStartCallback = $parse(attrs.ngDragStart) || null;
                var onDragStopCallback = $parse(attrs.ngDragStop) || null;
                var onDragSuccessCallback = $parse(attrs.ngDragSuccess) || null;
                var allowTransform = angular.isDefined(attrs.allowTransform) ? scope.$eval(attrs.allowTransform) : true;
                var doFollowMouse = (attrs.ngDragFollow === "false" || attrs.ngDragFollow === false)? false : true;


                var getDragData = $parse(attrs.ngDragData);
                var dragCloneData = {
                    group : attrs.ngDragCloneGroup || null,
                    copyHtml : (attrs.ngDragDCloneCopyHtml === "false" || attrs.ngDragDCloneCopyHtml === false)? false : true,
                    copyClass : (attrs.ngDragCloneCopyClass === "false" || attrs.ngDragCloneCopyClass === false)? false : true,
                    addClass : attrs.ngDragCloneAddClass || null,
                    hideOnClone : (attrs.ngDragCloneHide === "false" || attrs.ngDragCloneHide === false)? false : true
                };

                // deregistration function for mouse move events in $rootScope triggered by jqLite trigger handler
                var _deregisterRootMoveListener = angular.noop;

                var initialize = function () {
                    element.attr('draggable', 'false'); // prevent native drag
                    // check to see if drag handle(s) was specified
                    // if querySelectorAll is available, we use this instead of find
                    // as JQLite find is limited to tagnames
                    if (element[0].querySelectorAll) {
                        var dragHandles = angular.element(element[0].querySelectorAll('[ng-drag-handle]'));
                    } else {
                        var dragHandles = element.find('[ng-drag-handle]');
                    }
                    if (dragHandles.length) {
                        _dragHandle = dragHandles;
                    }
                    toggleListeners(true);
                };

                var toggleListeners = function (enable) {
                    if (!enable)return;
                    // add listeners.

                    scope.$on('$destroy', onDestroy);
                    scope.$watch(attrs.ngDrag, onEnableChange);
                    scope.$watch(attrs.ngCenterAnchor, onCenterAnchor);
                    // wire up touch events
                    if (_dragHandle) {
                        // handle(s) specified, use those to initiate drag
                        _dragHandle.on(_pressEvents, onpress);
                    } else {
                        // no handle(s) specified, use the element as the handle
                        element.on(_pressEvents, onpress);
                    }
                    if(! _hasTouch && element[0].nodeName.toLowerCase() == "img"){
                        element.on('mousedown', function(){ return false;}); // prevent native drag for images
                    }
                };
                var onDestroy = function (enable) {
                    toggleListeners(false);
                };
                var onEnableChange = function (newVal, oldVal) {
                    _dragEnabled = (newVal);
                };
                var onCenterAnchor = function (newVal, oldVal) {
                    if(angular.isDefined(newVal))
                        _centerAnchor = (newVal || 'true');
                };

                var isClickableElement = function (evt) {
                    return (
                        angular.isDefined(angular.element(evt.target).attr("ng-cancel-drag"))
                    );
                };
                /*
                 * When the element is clicked start the drag behaviour
                 * On touch devices as a small delay so as not to prevent native window scrolling
                 */
                var onpress = function(evt) {
                    if(! _dragEnabled)return;

                    if (isClickableElement(evt)) {
                        return;
                    }

                    if (evt.type == "mousedown" && evt.button != 0) {
                        // Do not start dragging on right-click
                        return;
                    }

                    if(_hasTouch){
                        cancelPress();
                        _pressTimer = setTimeout(function(){
                            cancelPress();
                            onlongpress(evt);
                        },100);
                        $document.on(_moveEvents, cancelPress);
                        $document.on(_releaseEvents, cancelPress);
                    }else{
                        onlongpress(evt);
                    }

                };

                var cancelPress = function() {
                    clearTimeout(_pressTimer);
                    $document.off(_moveEvents, cancelPress);
                    $document.off(_releaseEvents, cancelPress);
                };

                var onlongpress = function(evt) {
                    if(! _dragEnabled)return;
                    evt.preventDefault();

                    offset = element[0].getBoundingClientRect();
                    if(allowTransform)
                        _dragOffset = offset;
                    else{
                        _dragOffset = {left:document.body.scrollLeft, top:document.body.scrollTop};
                    }


                    element.centerX = element[0].offsetWidth / 2;
                    element.centerY = element[0].offsetHeight / 2;

                    _mx = ngDraggable.inputEvent(evt).pageX;//ngDraggable.getEventProp(evt, 'pageX');
                    _my = ngDraggable.inputEvent(evt).pageY;//ngDraggable.getEventProp(evt, 'pageY');
                    _mrx = _mx - offset.left;
                    _mry = _my - offset.top;
                    if (_centerAnchor) {
                        _tx = _mx - element.centerX - $window.pageXOffset;
                        _ty = _my - element.centerY - $window.pageYOffset;
                    } else {
                        _tx = _mx - _mrx - $window.pageXOffset;
                        _ty = _my - _mry - $window.pageYOffset;
                    }

                    $document.on(_moveEvents, onmove);
                    $document.on(_releaseEvents, onrelease);
                    // This event is used to receive manually triggered mouse move events
                    // jqLite unfortunately only supports triggerHandler(...)
                    // See http://api.jquery.com/triggerHandler/
                    // _deregisterRootMoveListener = $rootScope.$on('draggable:_triggerHandlerMove', onmove);
                    _deregisterRootMoveListener = $rootScope.$on('draggable:_triggerHandlerMove', function(event, origEvent) {
                        onmove(origEvent);
                    });
                };

                var onmove = function (evt) {
                    if (!_dragEnabled)return;
                    evt.preventDefault();

                    if (!element.hasClass('dragging')) {
                        _data = getDragData(scope);
                        element.addClass('dragging');
                        $rootScope.$broadcast('draggable:start', {x:_mx, y:_my, tx:_tx, ty:_ty, event:evt, element:element, data:_data, dragCloneData : dragCloneData});

                        if (onDragStartCallback ){
                            scope.$apply(function () {
                                onDragStartCallback(scope, {$data: _data, $event: evt});
                            });
                        }
                    }

                    _mx = ngDraggable.inputEvent(evt).pageX;//ngDraggable.getEventProp(evt, 'pageX');
                    _my = ngDraggable.inputEvent(evt).pageY;//ngDraggable.getEventProp(evt, 'pageY');

                    if (_centerAnchor) {
                        _tx = _mx - element.centerX - _dragOffset.left;
                        _ty = _my - element.centerY - _dragOffset.top;
                    } else {
                        _tx = _mx - _mrx - _dragOffset.left;
                        _ty = _my - _mry - _dragOffset.top;
                    }

                    moveElement(_tx, _ty);

                    $rootScope.$broadcast('draggable:move', { x: _mx, y: _my, tx: _tx, ty: _ty, event: evt, element: element, data: _data, uid: _myid, dragOffset: _dragOffset, dragCloneData : dragCloneData });
                };

                var onrelease = function(evt) {
                    if (!_dragEnabled)
                        return;
                    evt.preventDefault();
                    $rootScope.$broadcast('draggable:end', {x:_mx, y:_my, tx:_tx, ty:_ty, event:evt, element:element, data:_data, callback:onDragComplete, uid: _myid, dragCloneData : dragCloneData});
                    element.removeClass('dragging');
                    element.parent().find('.drag-enter').removeClass('drag-enter');
                    reset();
                    $document.off(_moveEvents, onmove);
                    $document.off(_releaseEvents, onrelease);

                    if (onDragStopCallback ){
                        scope.$apply(function () {
                            onDragStopCallback(scope, {$data: _data, $event: evt});
                        });
                    }

                    _deregisterRootMoveListener();
                };

                var onDragComplete = function(evt) {


                    if (!onDragSuccessCallback )return;

                    scope.$apply(function () {
                        onDragSuccessCallback(scope, {$data: _data, $event: evt});
                    });
                };

                var reset = function() {
                    if(allowTransform)
                        element.css({transform:'', 'z-index':'', '-webkit-transform':'', '-ms-transform':''});
                    else
                        element.css({'position':'',top:'',left:''});
                };

                var moveElement = function (x, y) {
                    if(!doFollowMouse)
                        return;

                    if(allowTransform) {
                        element.css({
                            transform: 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ' + x + ', ' + y + ', 0, 1)',
                            'z-index': 99999,
                            '-webkit-transform': 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ' + x + ', ' + y + ', 0, 1)',
                            '-ms-transform': 'matrix(1, 0, 0, 1, ' + x + ', ' + y + ')'
                        });
                    }else{
                        element.css({'left':x+'px','top':y+'px', 'position':'fixed'});
                    }
                };
                initialize();
            }
        };
    }])

    .directive('ngDrop', ['$rootScope', '$parse', '$timeout', '$window', '$document', 'ngDraggable', 'ngDragHitTest', function ($rootScope, $parse, $timeout, $window, $document, ngDraggable, ngDragHitTest) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                scope.value = attrs.ngDrop;
                scope.isTouching = false;

                var _lastDropTouch=null;

                var _myid = scope.$id;

                var _dropEnabled=false;

                var onDropCallback = $parse(attrs.ngDropSuccess);// || function(){};

                var onDragStartCallback = $parse(attrs.ngDragStart);
                var onDragStopCallback = $parse(attrs.ngDragStop);
                var onDragMoveCallback = $parse(attrs.ngDragMove);
                var onDragEnterCallback = $parse(attrs.ngDragEnter);
                var onDragLeaveCallback = $parse(attrs.ngDragLeave);

                var initialize = function () {
                    toggleListeners(true);
                };

                var toggleListeners = function (enable) {
                    // remove listeners

                    if (!enable)return;
                    // add listeners.
                    scope.$watch(attrs.ngDrop, onEnableChange);
                    scope.$on('$destroy', onDestroy);
                    scope.$on('draggable:start', onDragStart);
                    scope.$on('draggable:move', onDragMove);
                    scope.$on('draggable:end', onDragEnd);
                };

                var onDestroy = function (enable) {
                    toggleListeners(false);
                };
                var onEnableChange = function (newVal, oldVal) {
                    _dropEnabled=newVal;
                };
                var onDragStart = function(evt, obj) {
                    if(! _dropEnabled)return;
                    isTouching(obj.x,obj.y,obj.element);

                    if (attrs.ngDragStart) {
                        $timeout(function(){
                            onDragStartCallback(scope, {$data: obj.data, $event: obj});
                        });
                    }
                };

                var onDragMove = function(evt, obj) {
                    if(! _dropEnabled)return;

                    var dragElement = obj.element;
                    var cbData = {
                        "drag_data" : obj,
                        "drop" : element
                    }
                    var enterCb = function()
                    {
                        $rootScope.$broadcast('droppable:dragenter', {element : element, dragElement : dragElement});
                        if(attrs.ngDragEnter)
                        {
                            scope.$apply(function () {
                                onDragEnterCallback(scope, {$data : cbData,  $event : obj.event});
                            });
                        }
                    }

                    var leaveCb = function()
                    {
                        $rootScope.$broadcast('droppable:dragleave', {element : element, dragElement : dragElement});
                        if(attrs.ngDragLeave)
                        {
                            scope.$apply(function () {
                                onDragLeaveCallback(scope, {$data : cbData, $event : obj.event});
                            });
                        }
                    }

                    isTouching(obj.x,obj.y,obj.element, enterCb, leaveCb);
                    if (attrs.ngDragMove) {
                        $timeout(function(){
                            onDragMoveCallback(scope, {$data: obj.data, $event: obj});
                        });
                    }
                };


                var onDragEnd = function (evt, obj) {

                    // don't listen to drop events if this is the element being dragged
                    // only update the styles and return
                    if (!_dropEnabled || _myid === obj.uid) {
                        updateDragStyles(false, obj.element);
                        return;
                    }

                    if (isTouching(obj.x, obj.y, obj.element)) {
                        // call the ngDraggable ngDragSuccess element callback
                        if(obj.callback){
                            obj.callback(obj);
                        }

                        if (attrs.ngDropSuccess) {
                            $timeout(function(){
                                onDropCallback(scope, {$data: obj.data, $event: obj, $target: scope.$eval(scope.value)});
                            });
                        }
                    }

                    if (attrs.ngDragStop) {
                        $timeout(function(){
                            onDragStopCallback(scope, {$data: obj.data, $event: obj});
                        });
                    }

                    updateDragStyles(false, obj.element);
                };

                var isTouching = function(mouseX, mouseY, dragElement, enterCb, leaveCb) {
                    var touching= hitTest(mouseX, mouseY);
                    scope.isTouching = touching;
                    if(touching){
                        _lastDropTouch = element;
                    }
                    updateDragStyles(touching, dragElement, enterCb, leaveCb);
                    return touching;
                };

                var updateDragStyles = function(touching, dragElement, enterCb, leaveCb) {
                    if(touching){
                        var justEntered = !element.hasClass('drag-enter');
                        element.addClass('drag-enter');
                        dragElement.addClass('drag-over');
                        if(justEntered && enterCb)
                            enterCb();
                    }else if(_lastDropTouch == element){
                        _lastDropTouch=null;
                        var justLeaved = element.hasClass('drag-enter');
                        element.removeClass('drag-enter');
                        dragElement.removeClass('drag-over');
                        if(justLeaved && leaveCb)
                            leaveCb();
                    }
                };

                var hitTest = function(mouseX, mouseY) {
                    return ngDragHitTest(element[0], mouseX, mouseY).inside;
                };

                initialize();
            }
        };
    }])
    .directive('ngDragClone', ['$parse', '$timeout', 'ngDraggable', function ($parse, $timeout, ngDraggable) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var img, _allowClone=true;
                var _dragOffset = null;
                scope.clonedData = {};

                var _baseHTML = "";
                var _baseClass = "";
                var _group = attrs.ngDragCloneGroup || null;
                var _copyClass = (attrs.ngDragCloneCopyClass === "false" || attrs.ngDragCloneCopyClass === false)? false : true;
                var _copyHtml = (attrs.ngDragCloneCopyHtml === "false" || attrs.ngDragDCloneCopyHtml === false)? false : true;
                var _hideOnClone = (attrs.ngDragCloneHide === "false" || attrs.ngDragDCloneHide === false)? false : true;
                var _copyHtmlElement = element;
                if (_copyHtml && attrs.ngDragCloneCopyHtml !== "true" || attrs.ngDragCloneCopyHtml !== true)
                {
                    var foundElement = angular.element(element[0].querySelector(".clone_container"));
                    if (foundElement && foundElement.length > 0)
                        _copyHtmlElement = foundElement;
                }

                var _didCopyHtml = false;
                var _didCopyClass = false;
                var _didHide = false;

                var initialize = function () {
                    _baseHTML = _copyHtmlElement.html();
                    _baseClass = element.attr("class");
                    img = element.find('img');
                    element.attr('draggable', 'false');
                    img.attr('draggable', 'false');
                    reset();
                    toggleListeners(true);
                };


                var toggleListeners = function (enable) {
                    // remove listeners

                    if (!enable)return;
                    // add listeners.
                    scope.$on('draggable:start', onDragStart);
                    scope.$on('draggable:move', onDragMove);
                    scope.$on('draggable:end', onDragEnd);
                    scope.$on('droppable:dragenter', onDragEnterDrop);
                    scope.$on('droppable:dragleave', onDragLeaveDrop);
                    preventContextMenu();

                };
                var preventContextMenu = function() {
                    //  element.off('mousedown touchstart touchmove touchend touchcancel', absorbEvent_);
                    img.off('mousedown touchstart touchmove touchend touchcancel', absorbEvent_);
                    //  element.on('mousedown touchstart touchmove touchend touchcancel', absorbEvent_);
                    img.on('mousedown touchstart touchmove touchend touchcancel', absorbEvent_);
                };
                var onDragStart = function(evt, obj, elm) {
                    var dragCloneData = obj.dragCloneData;
                    var toCloneGroup = dragCloneData.group;
                    _allowClone = (toCloneGroup === null && _group === null) || toCloneGroup === _group;
                    if(angular.isDefined(obj.data.allowClone)){
                        _allowClone=obj.data.allowClone;
                    }
                    if(_allowClone) {
                        var toCloneElm = angular.element(obj.element[0]);

                        if(dragCloneData.copyHtml && _copyHtml)
                        {
                            _copyHtmlElement.html(toCloneElm.html());
                            _didCopyHtml = true;
                        }

                        if(dragCloneData.copyClass && _copyClass)
                        {
                            element.addClass(toCloneElm.attr("class"));
                            _didCopyClass = true;
                        }

                        element.addClass(dragCloneData.addClass);
                        scope.clonedGroup = toCloneGroup;
                        scope.$apply(function () {
                            scope.clonedData = obj.data;
                        });
                        element.css('width', obj.element[0].offsetWidth);
                        element.css('height', obj.element[0].offsetHeight);

                        if (_hideOnClone && dragCloneData.hideOnClone)
                        {
                            toCloneElm.css("visibility", "hidden");
                            _didHide = true;
                        }

                        moveElement(obj.tx, obj.ty);
                    }

                };
                var onDragMove = function(evt, obj) {
                    if(_allowClone) {

                        _tx = obj.tx + obj.dragOffset.left;
                        _ty = obj.ty + obj.dragOffset.top;

                        moveElement(_tx, _ty);
                    }
                };
                var onDragEnd = function(evt, obj) {
                    //moveElement(obj.tx,obj.ty);
                    if(_allowClone) {
                        reset(obj);
                    }
                };

                var onDragEnterDrop = function(evt, args)
                {
                    element.addClass("drag-over");
                }

                var onDragLeaveDrop = function(evt, args)
                {
                    element.removeClass("drag-over");
                }

                var reset = function(obj) {
                    if(_didCopyHtml)
                    {
                        _copyHtmlElement.html(_baseHTML);
                    }
                    if(_didCopyClass)
                        element.attr("class", _baseClass);
                    if(_didHide)
                        angular.element(obj.element[0]).css("visibility", "");
                    element.css({left:0,top:0, position:'fixed', 'z-index':-1, visibility:'hidden'});
                };
                var moveElement = function(x,y) {
                    element.css({
                        transform: 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, '+x+', '+y+', 0, 1)', 'z-index': 99999, 'visibility': 'visible',
                        '-webkit-transform': 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, '+x+', '+y+', 0, 1)',
                        '-ms-transform': 'matrix(1, 0, 0, 1, '+x+', '+y+')'
                        //,margin: '0'  don't monkey with the margin,
                    });
                };

                var absorbEvent_ = function (event) {
                    var e = event;//.originalEvent;
                    e.preventDefault && e.preventDefault();
                    e.stopPropagation && e.stopPropagation();
                    e.cancelBubble = true;
                    e.returnValue = false;
                    return false;
                };

                initialize();
            }
        };
    }])
    .directive('ngPreventDrag', ['$parse', '$timeout', function ($parse, $timeout) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var initialize = function () {

                    element.attr('draggable', 'false');
                    toggleListeners(true);
                };


                var toggleListeners = function (enable) {
                    // remove listeners

                    if (!enable)return;
                    // add listeners.
                    element.on('mousedown touchstart touchmove touchend touchcancel', absorbEvent_);
                };


                var absorbEvent_ = function (event) {
                    var e = event.originalEvent;
                    e.preventDefault && e.preventDefault();
                    e.stopPropagation && e.stopPropagation();
                    e.cancelBubble = true;
                    e.returnValue = false;
                    return false;
                };

                initialize();
            }
        };
    }])
    .directive('ngCancelDrag', [function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element.find('*').attr('ng-cancel-drag', 'ng-cancel-drag');
            }
        };
    }])
    .directive('ngDragScroll', ['$window', '$interval', '$timeout', '$document', '$rootScope', 'ngDragHitTest', function($window, $interval, $timeout, $document, $rootScope, ngDragHitTest) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                var intervalPromise = null;
                var lastMouseEvent = null;
                var lastDragObj = null;

                var config = {
                    verticalScroll: attrs.verticalScroll || true,
                    horizontalScroll: attrs.horizontalScroll || true,
                    activationDistance: attrs.activationDistance || 75,
                    scrollDistance: attrs.scrollDistance || 15,
                    scrollelement: null //It's the window itself :)
                };

                if (attrs.scrollElement)
                {
                    var foundElement = angular.element( document.querySelector( attrs.scrollElement ) );
                    if (foundElement && foundElement.length > 0)
                        config.scrollElements = foundElement;
                }


                var reqAnimFrame = (function() {
                    return window.requestAnimationFrame ||
                        window.webkitRequestAnimationFrame ||
                        window.mozRequestAnimationFrame ||
                        window.oRequestAnimationFrame ||
                        window.msRequestAnimationFrame ||
                        function( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element ) {
                            window.setTimeout(callback, 1000 / 60);
                        };
                })();


                var animationIsOn = false;
                var createInterval = function() {
                    animationIsOn = true;

                    function nextFrame(callback) {
                        var args = Array.prototype.slice.call(arguments);
                        if(animationIsOn) {
                            reqAnimFrame(function () {
                                $rootScope.$apply(function () {
                                    callback.apply(null, args);
                                    nextFrame(callback);
                                });
                            })
                        }
                    }

                    nextFrame(function() {
                        if (!lastMouseEvent) return;

                        // lastMouseEvent.clientX is undefined when dealing with a touch device, resulting in
                        // no scrolling when dragging an item to the bottom of the screen
                        // Seen on Chrome 47.0.2526.111
                        var clientX = lastMouseEvent.clientX;
                        if (angular.isUndefined(lastMouseEvent.clientX))
                            clientX = lastMouseEvent.touches[0].clientX;

                        // lastMouseEvent.clientY is undefined when dealing with a touch device, resulting in
                        // no scrolling when dragging an item to the bottom of the screen
                        // Seen on Chrome 47.0.2526.111
                        var clientY = lastMouseEvent.clientY;
                        if (angular.isUndefined(lastMouseEvent.clientY))
                            clientY = lastMouseEvent.touches[0].clientY;

                        var hoverElements = ["window"]; //Later, create a variable to check if the user want to scroll the window or not.
                        if(config.scrollElements)
                        {
                            var sides = {
                                "all"    : {"distance" : config.activationDistance}
                            };
                            angular.forEach(config.scrollElements, function(testElement){ //Generate the hittest for each element
                                var dragHitTestResult = ngDragHitTest(testElement, lastDragObj.x, lastDragObj.y, sides);
                                if(dragHitTestResult.inside)
                                {
                                    hoverElements.push({"element" : testElement, "hitTestResult" : dragHitTestResult});
                                }
                            });
                        }

                        var moved = false;
                        angular.forEach(hoverElements, function(hoverElem)
                        {
                            var isWindow = (hoverElem === "window");
                            var scrollX = 0;
                            var scrollY = 0;

                            if (config.horizontalScroll) {
                                if(isWindow)
                                {
                                    // If horizontal scrolling is active.
                                    var scrollXEnd = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                                    if (clientX < config.activationDistance) // If the mouse is on the left of the viewport within the activation distance.
                                        scrollX = -config.scrollDistance;
                                    else if (clientX > scrollXEnd - config.activationDistance)// If the mouse is on the right of the viewport within the activation distance.
                                        scrollX = config.scrollDistance;
                                }
                                else if (hoverElem.hitTestResult.right) //It's an element and it's on its right edge
                                {
                                    scrollX = config.scrollDistance;
                                }
                                else if(hoverElem.hitTestResult.left) //It's an element and it's on its left edge
                                {
                                    scrollX = -config.scrollDistance;
                                }
                            }

                            if (config.verticalScroll) {
                                if (isWindow)
                                {
                                    var scrollYEnd = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                                    // If vertical scrolling is active.
                                    if (clientY < config.activationDistance) {
                                        // If the mouse is on the top of the viewport within the activation distance.
                                        scrollY = -config.scrollDistance;
                                    }
                                    else if (clientY > scrollYEnd - config.activationDistance) {
                                        // If the mouse is on the bottom of the viewport within the activation distance.
                                        scrollY = config.scrollDistance;
                                    }
                                }
                                else if (hoverElem.hitTestResult.top) //It's an element and it's on its right edge
                                {
                                    scrollY = -config.scrollDistance;
                                }
                                else if(hoverElem.hitTestResult.bottom) //It's an element and it's on its left edge
                                {
                                    scrollY = config.scrollDistance;
                                }
                            }

                            if (scrollX !== 0 || scrollY !== 0) {
                                moved = true;

                                // Remove the transformation from the element, scroll the window by the scroll distance
                                // record how far we scrolled, then reapply the element transformation.
                                var elementTransform = element.css('transform');
                                element.css('transform', 'initial');

                                if(isWindow){
                                    $window.scrollBy(scrollX, scrollY);
                                    // Record the current scroll position.
                                    var currentScrollLeft = ($window.pageXOffset || $document[0].documentElement.scrollLeft);
                                    var currentScrollTop = ($window.pageYOffset || $document[0].documentElement.scrollTop);

                                    var horizontalScrollAmount = ($window.pageXOffset || $document[0].documentElement.scrollLeft) - currentScrollLeft;
                                    var verticalScrollAmount =  ($window.pageYOffset || $document[0].documentElement.scrollTop) - currentScrollTop;

                                    lastMouseEvent.pageX += horizontalScrollAmount;
                                    lastMouseEvent.pageY += verticalScrollAmount;
                                }
                                else {
                                    var elementToMove = angular.element(hoverElem.element);
                                    elementToMove[0].scrollTop = elementToMove[0].scrollTop + scrollY;
                                    elementToMove[0].scrollLeft = elementToMove[0].scrollLeft + scrollX;
                                }
                                //reaply the element transfrom
                                element.css('transform', elementTransform);
                            }
                        });//End angular forEach

                        if (moved)
                            $rootScope.$emit('draggable:_triggerHandlerMove', lastMouseEvent);
                    }); //End nextFrame
                };

                var clearInterval = function() {
                    animationIsOn = false;
                };

                scope.$on('draggable:start', function(event, obj) {
                    // Ignore this event if it's not for this element.
                    if (obj.element[0] !== element[0]) return;

                    if (!animationIsOn) createInterval();
                });

                scope.$on('draggable:end', function(event, obj) {
                    // Ignore this event if it's not for this element.
                    if (obj.element[0] !== element[0]) return;

                    if (animationIsOn) clearInterval();
                });

                scope.$on('draggable:move', function(event, obj) {
                    // Ignore this event if it's not for this element.
                    if (obj.element[0] !== element[0]) return;

                    lastMouseEvent = obj.event;
                    lastDragObj = obj;
                });
            }
        };
    }]);
