
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.30.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/MapBase.svelte generated by Svelte v3.30.0 */

    const { console: console_1 } = globals;
    const file = "src/MapBase.svelte";

    function create_fragment(ctx) {
    	let input;
    	let input_class_value;
    	let t;
    	let div;
    	let svg;
    	let path;
    	let svg_class_value;

    	const block = {
    		c: function create() {
    			input = element("input");
    			t = space();
    			div = element("div");
    			svg = svg_element("svg");
    			path = svg_element("path");

    			attr_dev(input, "class", input_class_value = /*mapLoaded*/ ctx[2]
    			? "rounded px-2 py-1 m-3 border border-gray-300 text-base"
    			: "hidden");

    			add_location(input, file, 93, 0, 3000);
    			attr_dev(path, "fill-rule", "evenodd");
    			attr_dev(path, "clip-rule", "evenodd");
    			attr_dev(path, "d", "M0 10C0 15.5228 4.47715 20 10 20C15.5228 20 20 15.5228 20 10C20 4.47715 15.5228 0 10 0V2C14.4183 2 18 5.58172 18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10H0Z");
    			attr_dev(path, "fill", "#374151");
    			add_location(path, file, 109, 2, 3399);
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "viewBox", "0 0 20 20");
    			attr_dev(svg, "class", svg_class_value = /*mapLoaded*/ ctx[2] ? "hidden" : "w-24 animate-spin");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file, 102, 1, 3234);
    			attr_dev(div, "class", "h-80 rounded-md my-2 flex items-center justify-center bg-gray-200");
    			add_location(div, file, 99, 0, 3129);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			/*input_binding*/ ctx[7](input);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, svg);
    			append_dev(svg, path);
    			/*div_binding*/ ctx[8](div);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*mapLoaded*/ 4 && input_class_value !== (input_class_value = /*mapLoaded*/ ctx[2]
    			? "rounded px-2 py-1 m-3 border border-gray-300 text-base"
    			: "hidden")) {
    				attr_dev(input, "class", input_class_value);
    			}

    			if (dirty & /*mapLoaded*/ 4 && svg_class_value !== (svg_class_value = /*mapLoaded*/ ctx[2] ? "hidden" : "w-24 animate-spin")) {
    				attr_dev(svg, "class", svg_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			/*input_binding*/ ctx[7](null);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[8](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("MapBase", slots, []);
    	let { selectedPlace } = $$props;
    	let map;
    	let zoom;
    	let center;
    	let container;
    	let searchInput;
    	let mapLoaded = false;
    	const icon = { url: "assets/marker_star.png" };

    	const initGeoloc = position => {
    		console.log(`position found: ${JSON.stringify(position)}`);
    		let coords = position.coords;

    		$$invalidate(6, center = {
    			lat: coords.latitude,
    			lng: coords.longitude
    		});

    		$$invalidate(5, zoom = 15);
    	};

    	const initWithoutGeoloc = () => {
    		console.warn("Geolocation API not available");
    		$$invalidate(6, center = { lat: 40.812579, lng: -95.726705 });
    		$$invalidate(5, zoom = 3);
    	};

    	if (navigator.geolocation) {
    		navigator.geolocation.getCurrentPosition(initGeoloc, initWithoutGeoloc, { timeout: 2000 });
    	} else {
    		initWithoutGeoloc();
    	}

    	const writable_props = ["selectedPlace"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<MapBase> was created with unknown prop '${key}'`);
    	});

    	function input_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			searchInput = $$value;
    			$$invalidate(1, searchInput);
    		});
    	}

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			container = $$value;
    			$$invalidate(0, container);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("selectedPlace" in $$props) $$invalidate(3, selectedPlace = $$props.selectedPlace);
    	};

    	$$self.$capture_state = () => ({
    		selectedPlace,
    		map,
    		zoom,
    		center,
    		container,
    		searchInput,
    		mapLoaded,
    		icon,
    		initGeoloc,
    		initWithoutGeoloc
    	});

    	$$self.$inject_state = $$props => {
    		if ("selectedPlace" in $$props) $$invalidate(3, selectedPlace = $$props.selectedPlace);
    		if ("map" in $$props) $$invalidate(4, map = $$props.map);
    		if ("zoom" in $$props) $$invalidate(5, zoom = $$props.zoom);
    		if ("center" in $$props) $$invalidate(6, center = $$props.center);
    		if ("container" in $$props) $$invalidate(0, container = $$props.container);
    		if ("searchInput" in $$props) $$invalidate(1, searchInput = $$props.searchInput);
    		if ("mapLoaded" in $$props) $$invalidate(2, mapLoaded = $$props.mapLoaded);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*zoom, container, center, searchInput, map*/ 115) {
    			 if (zoom) {
    				$$invalidate(4, map = new google.maps.Map(container, { zoom, center }));
    				const searchBox = new google.maps.places.SearchBox(searchInput);
    				map.controls[google.maps.ControlPosition.TOP_LEFT].push(searchInput);
    				$$invalidate(2, mapLoaded = true);

    				map.addListener("bounds_changed", () => {
    					searchBox.setBounds(map.getBounds());
    					let markers = [];

    					searchBox.addListener("places_changed", () => {
    						const places = searchBox.getPlaces();

    						if (places.length == 0) {
    							return;
    						}

    						// Clear out the old markers.
    						// Clear out the old markers.
    						markers.forEach(marker => {
    							marker.setMap(null);
    						});

    						markers = [];

    						// For each place, get the icon, name and location.
    						const bounds = new google.maps.LatLngBounds();

    						places.forEach(place => {
    							if (!place.geometry) {
    								console.log("Returned place contains no geometry");
    								return;
    							}

    							// Create a marker for each place.
    							$$invalidate(3, selectedPlace = place.geometry.location.toJSON());

    							markers.push(new google.maps.Marker({
    									map,
    									icon,
    									title: place.name,
    									position: place.geometry.location
    								}));

    							if (place.geometry.viewport) {
    								// Only geocodes have viewport.
    								bounds.union(place.geometry.viewport);
    							} else {
    								bounds.extend(place.geometry.location);
    							}
    						});

    						map.fitBounds(bounds);
    					});

    					map.addListener("click", mapsMouseEvent => {
    						// Close the current InfoWindow.
    						markers.forEach(marker => {
    							marker.setMap(null);
    						});

    						markers = [];
    						$$invalidate(3, selectedPlace = mapsMouseEvent.latLng.toJSON());

    						markers.push(new google.maps.Marker({
    								map,
    								icon,
    								position: mapsMouseEvent.latLng
    							}));
    					});
    				});
    			}
    		}
    	};

    	return [
    		container,
    		searchInput,
    		mapLoaded,
    		selectedPlace,
    		map,
    		zoom,
    		center,
    		input_binding,
    		div_binding
    	];
    }

    class MapBase extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { selectedPlace: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MapBase",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*selectedPlace*/ ctx[3] === undefined && !("selectedPlace" in props)) {
    			console_1.warn("<MapBase> was created without expected prop 'selectedPlace'");
    		}
    	}

    	get selectedPlace() {
    		throw new Error("<MapBase>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedPlace(value) {
    		throw new Error("<MapBase>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/ConfigScreen.svelte generated by Svelte v3.30.0 */
    const file$1 = "src/ConfigScreen.svelte";

    // (30:1) {#if mapReady}
    function create_if_block_1(ctx) {
    	let mapbase;
    	let updating_selectedPlace;
    	let current;

    	function mapbase_selectedPlace_binding(value) {
    		/*mapbase_selectedPlace_binding*/ ctx[5].call(null, value);
    	}

    	let mapbase_props = {};

    	if (/*selectedPlace*/ ctx[0] !== void 0) {
    		mapbase_props.selectedPlace = /*selectedPlace*/ ctx[0];
    	}

    	mapbase = new MapBase({ props: mapbase_props, $$inline: true });
    	binding_callbacks.push(() => bind(mapbase, "selectedPlace", mapbase_selectedPlace_binding));

    	const block = {
    		c: function create() {
    			create_component(mapbase.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(mapbase, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const mapbase_changes = {};

    			if (!updating_selectedPlace && dirty & /*selectedPlace*/ 1) {
    				updating_selectedPlace = true;
    				mapbase_changes.selectedPlace = /*selectedPlace*/ ctx[0];
    				add_flush_callback(() => updating_selectedPlace = false);
    			}

    			mapbase.$set(mapbase_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(mapbase.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(mapbase.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(mapbase, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(30:1) {#if mapReady}",
    		ctx
    	});

    	return block;
    }

    // (70:1) {#if error}
    function create_if_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "Please choose a location on the map before continuing.";
    			attr_dev(div, "class", "text-red-800 p-2 text-sm italic");
    			add_location(div, file$1, 70, 2, 1948);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(70:1) {#if error}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div3;
    	let div0;
    	let span0;
    	let t1;
    	let h20;
    	let t3;
    	let p0;
    	let t5;
    	let t6;
    	let div1;
    	let span1;
    	let t8;
    	let h21;
    	let t10;
    	let label;
    	let div2;
    	let p1;
    	let t11;
    	let t12;
    	let t13;
    	let p2;
    	let t14;
    	let t15_value = Math.floor(/*miles*/ ctx[4] * 15) + "";
    	let t15;
    	let t16;
    	let t17;
    	let input;
    	let t18;
    	let button;
    	let t19;
    	let button_class_value;
    	let t20;
    	let div3_intro;
    	let div3_outro;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*mapReady*/ ctx[1] && create_if_block_1(ctx);
    	let if_block1 = /*error*/ ctx[3] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			span0.textContent = "1";
    			t1 = space();
    			h20 = element("h2");
    			h20.textContent = "Choose your start and end point";
    			t3 = space();
    			p0 = element("p");
    			p0.textContent = "Type an address in the box or click any point on the map";
    			t5 = space();
    			if (if_block0) if_block0.c();
    			t6 = space();
    			div1 = element("div");
    			span1 = element("span");
    			span1.textContent = "2";
    			t8 = space();
    			h21 = element("h2");
    			h21.textContent = "Choose your route length";
    			t10 = space();
    			label = element("label");
    			div2 = element("div");
    			p1 = element("p");
    			t11 = text(/*miles*/ ctx[4]);
    			t12 = text(" miles");
    			t13 = space();
    			p2 = element("p");
    			t14 = text("(about ");
    			t15 = text(t15_value);
    			t16 = text(" minutes)");
    			t17 = space();
    			input = element("input");
    			t18 = space();
    			button = element("button");
    			t19 = text("continue");
    			t20 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(span0, "class", "flex-initial border-4 border-fuchsia-800 text-fuchsia-800 font-black text-3xl leading-none px-3.5 py-2 rounded-full");
    			add_location(span0, file$1, 19, 2, 572);
    			attr_dev(h20, "class", "flex-1 font-bold text-2xl border-b border-gray-300 italic leading-none mx-4");
    			add_location(h20, file$1, 22, 2, 720);
    			attr_dev(div0, "class", "flex items-center mb-4");
    			add_location(div0, file$1, 18, 1, 533);
    			attr_dev(p0, "class", "ml-2");
    			add_location(p0, file$1, 27, 1, 864);
    			attr_dev(span1, "class", "flex-initial border-4 border-fuchsia-800 text-fuchsia-800 font-black text-3xl leading-none px-3.5 py-2 rounded-full");
    			add_location(span1, file$1, 34, 2, 1039);
    			attr_dev(h21, "class", "flex-1 font-bold text-2xl border-b border-gray-300 italic leading-none mx-4");
    			add_location(h21, file$1, 37, 2, 1187);
    			attr_dev(div1, "class", "flex items-center my-4");
    			add_location(div1, file$1, 33, 1, 1000);
    			attr_dev(p1, "class", "leading-tight");
    			add_location(p1, file$1, 45, 3, 1396);
    			attr_dev(p2, "class", "leading-tight");
    			add_location(p2, file$1, 46, 3, 1442);
    			attr_dev(div2, "class", "flex-initial");
    			add_location(div2, file$1, 44, 2, 1366);
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "5");
    			attr_dev(input, "step", ".25");
    			attr_dev(input, "class", "m-2 flex-1");
    			add_location(input, file$1, 48, 2, 1523);
    			attr_dev(label, "class", "flex items-center ml-2");
    			add_location(label, file$1, 43, 1, 1325);

    			attr_dev(button, "class", button_class_value = "px-2 py-1 w-full mt-4 text-gray-50 rounded " + (/*selectedPlace*/ ctx[0]
    			? "bg-indigo-800"
    			: "bg-gray-300 cursor-pointer"));

    			add_location(button, file$1, 57, 1, 1641);
    			attr_dev(div3, "class", "max-w-2xl rounded-xl bg-gray-50 border border-gray-400 shadow-xl mx-2 sm:mx-10 md:mx-auto p-4 md:p-6");
    			add_location(div3, file$1, 14, 0, 329);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, span0);
    			append_dev(div0, t1);
    			append_dev(div0, h20);
    			append_dev(div3, t3);
    			append_dev(div3, p0);
    			append_dev(div3, t5);
    			if (if_block0) if_block0.m(div3, null);
    			append_dev(div3, t6);
    			append_dev(div3, div1);
    			append_dev(div1, span1);
    			append_dev(div1, t8);
    			append_dev(div1, h21);
    			append_dev(div3, t10);
    			append_dev(div3, label);
    			append_dev(label, div2);
    			append_dev(div2, p1);
    			append_dev(p1, t11);
    			append_dev(p1, t12);
    			append_dev(div2, t13);
    			append_dev(div2, p2);
    			append_dev(p2, t14);
    			append_dev(p2, t15);
    			append_dev(p2, t16);
    			append_dev(label, t17);
    			append_dev(label, input);
    			set_input_value(input, /*miles*/ ctx[4]);
    			append_dev(div3, t18);
    			append_dev(div3, button);
    			append_dev(button, t19);
    			append_dev(div3, t20);
    			if (if_block1) if_block1.m(div3, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[6]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[6]),
    					listen_dev(button, "click", /*click_handler*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*mapReady*/ ctx[1]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*mapReady*/ 2) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div3, t6);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*miles*/ 16) set_data_dev(t11, /*miles*/ ctx[4]);
    			if ((!current || dirty & /*miles*/ 16) && t15_value !== (t15_value = Math.floor(/*miles*/ ctx[4] * 15) + "")) set_data_dev(t15, t15_value);

    			if (dirty & /*miles*/ 16) {
    				set_input_value(input, /*miles*/ ctx[4]);
    			}

    			if (!current || dirty & /*selectedPlace*/ 1 && button_class_value !== (button_class_value = "px-2 py-1 w-full mt-4 text-gray-50 rounded " + (/*selectedPlace*/ ctx[0]
    			? "bg-indigo-800"
    			: "bg-gray-300 cursor-pointer"))) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (/*error*/ ctx[3]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(div3, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);

    			add_render_callback(() => {
    				if (div3_outro) div3_outro.end(1);
    				if (!div3_intro) div3_intro = create_in_transition(div3, fly, { x: -300, duration: 200, delay: 200 });
    				div3_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div3_intro) div3_intro.invalidate();
    			div3_outro = create_out_transition(div3, fly, { x: -300, duration: 200 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching && div3_outro) div3_outro.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ConfigScreen", slots, []);
    	let { mapReady = false } = $$props;
    	let { selectedPlace } = $$props;
    	let { pathToMap } = $$props;
    	let error = false;
    	let miles = 2;
    	const writable_props = ["mapReady", "selectedPlace", "pathToMap"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ConfigScreen> was created with unknown prop '${key}'`);
    	});

    	function mapbase_selectedPlace_binding(value) {
    		selectedPlace = value;
    		$$invalidate(0, selectedPlace);
    	}

    	function input_change_input_handler() {
    		miles = to_number(this.value);
    		$$invalidate(4, miles);
    	}

    	const click_handler = () => {
    		if (selectedPlace) {
    			pathToMap(selectedPlace, miles * 1.609 * 1000);
    		} else {
    			$$invalidate(3, error = true);
    		}
    	};

    	$$self.$$set = $$props => {
    		if ("mapReady" in $$props) $$invalidate(1, mapReady = $$props.mapReady);
    		if ("selectedPlace" in $$props) $$invalidate(0, selectedPlace = $$props.selectedPlace);
    		if ("pathToMap" in $$props) $$invalidate(2, pathToMap = $$props.pathToMap);
    	};

    	$$self.$capture_state = () => ({
    		MapBase,
    		fly,
    		mapReady,
    		selectedPlace,
    		pathToMap,
    		error,
    		miles
    	});

    	$$self.$inject_state = $$props => {
    		if ("mapReady" in $$props) $$invalidate(1, mapReady = $$props.mapReady);
    		if ("selectedPlace" in $$props) $$invalidate(0, selectedPlace = $$props.selectedPlace);
    		if ("pathToMap" in $$props) $$invalidate(2, pathToMap = $$props.pathToMap);
    		if ("error" in $$props) $$invalidate(3, error = $$props.error);
    		if ("miles" in $$props) $$invalidate(4, miles = $$props.miles);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*selectedPlace*/ 1) {
    			 {
    				if (selectedPlace) {
    					$$invalidate(3, error = false);
    				}
    			}
    		}
    	};

    	return [
    		selectedPlace,
    		mapReady,
    		pathToMap,
    		error,
    		miles,
    		mapbase_selectedPlace_binding,
    		input_change_input_handler,
    		click_handler
    	];
    }

    class ConfigScreen extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			mapReady: 1,
    			selectedPlace: 0,
    			pathToMap: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ConfigScreen",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*selectedPlace*/ ctx[0] === undefined && !("selectedPlace" in props)) {
    			console.warn("<ConfigScreen> was created without expected prop 'selectedPlace'");
    		}

    		if (/*pathToMap*/ ctx[2] === undefined && !("pathToMap" in props)) {
    			console.warn("<ConfigScreen> was created without expected prop 'pathToMap'");
    		}
    	}

    	get mapReady() {
    		throw new Error("<ConfigScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mapReady(value) {
    		throw new Error("<ConfigScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedPlace() {
    		throw new Error("<ConfigScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedPlace(value) {
    		throw new Error("<ConfigScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pathToMap() {
    		throw new Error("<ConfigScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pathToMap(value) {
    		throw new Error("<ConfigScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/ResultsMap.svelte generated by Svelte v3.30.0 */

    const { console: console_1$1 } = globals;
    const file$2 = "src/ResultsMap.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let svg;
    	let path;
    	let svg_class_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			svg = svg_element("svg");
    			path = svg_element("path");
    			attr_dev(path, "fill-rule", "evenodd");
    			attr_dev(path, "clip-rule", "evenodd");
    			attr_dev(path, "d", "M0 10C0 15.5228 4.47715 20 10 20C15.5228 20 20 15.5228 20 10C20 4.47715 15.5228 0 10 0V2C14.4183 2 18 5.58172 18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10H0Z");
    			attr_dev(path, "fill", "#374151");
    			add_location(path, file$2, 113, 2, 2765);
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "viewBox", "0 0 20 20");
    			attr_dev(svg, "class", svg_class_value = /*mapLoaded*/ ctx[1] ? "hidden" : "w-24 animate-spin");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file$2, 106, 1, 2600);
    			attr_dev(div, "class", "h-80 rounded-md my-2 flex items-center justify-center bg-gray-200");
    			add_location(div, file$2, 103, 0, 2495);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, svg);
    			append_dev(svg, path);
    			/*div_binding*/ ctx[10](div);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*mapLoaded*/ 2 && svg_class_value !== (svg_class_value = /*mapLoaded*/ ctx[1] ? "hidden" : "w-24 animate-spin")) {
    				attr_dev(svg, "class", svg_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[10](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ResultsMap", slots, []);
    	let { selectedPlace } = $$props;
    	let { waypoints } = $$props;
    	let { selectedLibrary } = $$props;
    	let map;
    	let directionsService;
    	let directionsRenderer;
    	let zoom;
    	let center;
    	let container;
    	let mapLoaded = false;
    	const star_icon = { url: "assets/marker_star.png" };
    	const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];

    	const initGeoloc = position => {
    		console.log(`position found: ${JSON.stringify(position)}`);
    		let coords = position.coords;

    		$$invalidate(9, center = {
    			lat: coords.latitude,
    			lng: coords.longitude
    		});

    		$$invalidate(8, zoom = 15);
    	};

    	const initWithoutGeoloc = () => {
    		console.warn("Geolocation API not available");
    		$$invalidate(9, center = { lat: 40.812579, lng: -95.726705 });
    		$$invalidate(8, zoom = 3);
    	};

    	if (navigator.geolocation) {
    		navigator.geolocation.getCurrentPosition(initGeoloc, initWithoutGeoloc, { timeout: 2000 });
    	} else {
    		initWithoutGeoloc();
    	}

    	const writable_props = ["selectedPlace", "waypoints", "selectedLibrary"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<ResultsMap> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			container = $$value;
    			$$invalidate(0, container);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("selectedPlace" in $$props) $$invalidate(2, selectedPlace = $$props.selectedPlace);
    		if ("waypoints" in $$props) $$invalidate(3, waypoints = $$props.waypoints);
    		if ("selectedLibrary" in $$props) $$invalidate(4, selectedLibrary = $$props.selectedLibrary);
    	};

    	$$self.$capture_state = () => ({
    		selectedPlace,
    		waypoints,
    		selectedLibrary,
    		map,
    		directionsService,
    		directionsRenderer,
    		zoom,
    		center,
    		container,
    		mapLoaded,
    		star_icon,
    		letters,
    		initGeoloc,
    		initWithoutGeoloc
    	});

    	$$self.$inject_state = $$props => {
    		if ("selectedPlace" in $$props) $$invalidate(2, selectedPlace = $$props.selectedPlace);
    		if ("waypoints" in $$props) $$invalidate(3, waypoints = $$props.waypoints);
    		if ("selectedLibrary" in $$props) $$invalidate(4, selectedLibrary = $$props.selectedLibrary);
    		if ("map" in $$props) $$invalidate(5, map = $$props.map);
    		if ("directionsService" in $$props) $$invalidate(6, directionsService = $$props.directionsService);
    		if ("directionsRenderer" in $$props) $$invalidate(7, directionsRenderer = $$props.directionsRenderer);
    		if ("zoom" in $$props) $$invalidate(8, zoom = $$props.zoom);
    		if ("center" in $$props) $$invalidate(9, center = $$props.center);
    		if ("container" in $$props) $$invalidate(0, container = $$props.container);
    		if ("mapLoaded" in $$props) $$invalidate(1, mapLoaded = $$props.mapLoaded);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*zoom, container, center, directionsRenderer, map, directionsService, selectedPlace, waypoints*/ 1005) {
    			 if (zoom) {
    				$$invalidate(5, map = new google.maps.Map(container, { zoom, center }));
    				$$invalidate(6, directionsService = new google.maps.DirectionsService());
    				$$invalidate(7, directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true }));
    				directionsRenderer.setMap(map);

    				directionsService.route(
    					{
    						origin: selectedPlace,
    						destination: selectedPlace,
    						waypoints,
    						travelMode: google.maps.TravelMode.WALKING
    					},
    					result => {
    						directionsRenderer.setDirections(result);
    					}
    				);

    				let markers = [];

    				markers.push(new google.maps.Marker({
    						icon: star_icon,
    						map,
    						position: selectedPlace
    					}));

    				waypoints.forEach((pt, i) => {
    					const latLng = pt.location.split(",");

    					markers.push(new google.maps.Marker({
    							// icon: reg_icon,
    							label: { text: letters[i], color: "#ffffff" },
    							map,
    							position: new google.maps.LatLng({ lat: +latLng[0], lng: +latLng[1] }),
    							clickable: true
    						}));
    				});

    				$$invalidate(1, mapLoaded = true);
    			}
    		}

    		if ($$self.$$.dirty & /*selectedLibrary, map*/ 48) {
    			 {
    				if (selectedLibrary) {
    					map.setZoom(14);

    					setTimeout(
    						() => {
    							map.setCenter({
    								lat: selectedLibrary.Library_Geolocation__c.latitude,
    								lng: selectedLibrary.Library_Geolocation__c.longitude
    							});

    							map.setZoom(17);
    						},
    						500
    					);
    				}
    			}
    		}
    	};

    	return [
    		container,
    		mapLoaded,
    		selectedPlace,
    		waypoints,
    		selectedLibrary,
    		map,
    		directionsService,
    		directionsRenderer,
    		zoom,
    		center,
    		div_binding
    	];
    }

    class ResultsMap extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			selectedPlace: 2,
    			waypoints: 3,
    			selectedLibrary: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ResultsMap",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*selectedPlace*/ ctx[2] === undefined && !("selectedPlace" in props)) {
    			console_1$1.warn("<ResultsMap> was created without expected prop 'selectedPlace'");
    		}

    		if (/*waypoints*/ ctx[3] === undefined && !("waypoints" in props)) {
    			console_1$1.warn("<ResultsMap> was created without expected prop 'waypoints'");
    		}

    		if (/*selectedLibrary*/ ctx[4] === undefined && !("selectedLibrary" in props)) {
    			console_1$1.warn("<ResultsMap> was created without expected prop 'selectedLibrary'");
    		}
    	}

    	get selectedPlace() {
    		throw new Error("<ResultsMap>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedPlace(value) {
    		throw new Error("<ResultsMap>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get waypoints() {
    		throw new Error("<ResultsMap>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set waypoints(value) {
    		throw new Error("<ResultsMap>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedLibrary() {
    		throw new Error("<ResultsMap>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedLibrary(value) {
    		throw new Error("<ResultsMap>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/FootstepsAnimation.svelte generated by Svelte v3.30.0 */

    const file$3 = "src/FootstepsAnimation.svelte";

    function create_fragment$3(ctx) {
    	let svg;
    	let g4;
    	let g0;
    	let path0;
    	let path1;
    	let g1;
    	let path2;
    	let path3;
    	let g2;
    	let path4;
    	let path5;
    	let g3;
    	let path6;
    	let path7;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g4 = svg_element("g");
    			g0 = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			g1 = svg_element("g");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			g2 = svg_element("g");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			g3 = svg_element("g");
    			path6 = svg_element("path");
    			path7 = svg_element("path");
    			attr_dev(path0, "id", "foot_1a");
    			attr_dev(path0, "d", "M448.916 1574.38C495.888 1530.18 507.974 1458.39 471.996 1420.15C428.077 1373.48 357.608 1408.04 309.049 1439.61C252.396 1476.44 240.612 1526.66 191.09 1573.26L266.192 1685.91C319.63 1673.38 388.033 1631.67 448.916 1574.38Z");
    			attr_dev(path0, "fill", "#D1D5DB");
    			add_location(path0, file$3, 9, 6, 195);
    			attr_dev(path1, "id", "foot_1b");
    			attr_dev(path1, "d", "M147.482 1599.88C169.645 1650.43 174.699 1658.72 208.32 1704.66C120.203 1764.24 66.1796 1788.43 32.5652 1726.56C-1.04916 1664.69 76.7155 1623.91 147.482 1599.88Z");
    			attr_dev(path1, "fill", "#D1D5DB");
    			add_location(path1, file$3, 13, 6, 490);
    			attr_dev(g0, "id", "foot_1");
    			add_location(g0, file$3, 8, 4, 173);
    			attr_dev(path2, "id", "foot_2a");
    			attr_dev(path2, "d", "M738.727 782.603C800.342 763.527 868.76 788.406 884.287 838.557C903.241 899.777 838.436 944.051 787.027 970.734C727.051 1001.86 677.546 987.357 612.588 1007.47L551.612 886.594C588.854 846.276 658.867 807.328 738.727 782.603Z");
    			attr_dev(path2, "fill", "#D1D5DB");
    			add_location(path2, file$3, 19, 6, 752);
    			attr_dev(path3, "id", "foot_2b");
    			attr_dev(path3, "d", "M567.93 1032.29C534.879 988.083 530.159 979.599 506.762 927.697C411.486 974.99 363.809 1010.07 401.065 1069.81C438.321 1129.56 512.14 1082.01 567.93 1032.29Z");
    			attr_dev(path3, "fill", "#D1D5DB");
    			add_location(path3, file$3, 23, 6, 1048);
    			attr_dev(g1, "id", "foot_2");
    			add_location(g1, file$3, 18, 4, 730);
    			attr_dev(path4, "id", "foot_3a");
    			attr_dev(path4, "d", "M1698.92 882.379C1745.89 838.177 1757.97 766.387 1722 728.153C1678.08 681.481 1607.61 716.036 1559.05 747.607C1502.4 784.441 1490.61 834.664 1441.09 881.265L1516.19 993.907C1569.63 981.382 1638.03 939.67 1698.92 882.379Z");
    			attr_dev(path4, "fill", "#D1D5DB");
    			add_location(path4, file$3, 29, 6, 1306);
    			attr_dev(path5, "id", "foot_3b");
    			attr_dev(path5, "d", "M1397.48 907.883C1419.64 958.43 1424.7 966.719 1458.32 1012.66C1370.2 1072.24 1316.18 1096.43 1282.57 1034.56C1248.95 972.688 1326.72 931.908 1397.48 907.883Z");
    			attr_dev(path5, "fill", "#D1D5DB");
    			add_location(path5, file$3, 33, 6, 1598);
    			attr_dev(g2, "id", "foot_3");
    			add_location(g2, file$3, 28, 4, 1284);
    			attr_dev(path6, "id", "foot_4a");
    			attr_dev(path6, "d", "M1957.04 36.2292C2018.66 17.1534 2087.07 42.0317 2102.6 92.1832C2121.56 153.403 2056.75 197.677 2005.34 224.36C1945.37 255.491 1895.86 240.983 1830.9 261.094L1769.93 140.22C1807.17 99.9023 1877.18 60.9537 1957.04 36.2292Z");
    			attr_dev(path6, "fill", "#D1D5DB");
    			add_location(path6, file$3, 39, 6, 1857);
    			attr_dev(path7, "id", "foot_4b");
    			attr_dev(path7, "d", "M1786.24 285.911C1753.19 241.709 1748.47 233.225 1725.08 181.323C1629.8 228.616 1582.12 263.693 1619.38 323.44C1656.64 383.188 1730.45 335.636 1786.24 285.911Z");
    			attr_dev(path7, "fill", "#D1D5DB");
    			add_location(path7, file$3, 43, 6, 2150);
    			attr_dev(g3, "id", "foot_4");
    			add_location(g3, file$3, 38, 4, 1835);
    			attr_dev(g4, "id", "footsteps");
    			add_location(g4, file$3, 7, 2, 150);
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "viewBox", "0 0 2133 1805");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "class", "max-w-full w-64 mx-auto");
    			add_location(svg, file$3, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, g4);
    			append_dev(g4, g0);
    			append_dev(g0, path0);
    			append_dev(g0, path1);
    			append_dev(g4, g1);
    			append_dev(g1, path2);
    			append_dev(g1, path3);
    			append_dev(g4, g2);
    			append_dev(g2, path4);
    			append_dev(g2, path5);
    			append_dev(g4, g3);
    			append_dev(g3, path6);
    			append_dev(g3, path7);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("FootstepsAnimation", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<FootstepsAnimation> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class FootstepsAnimation extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FootstepsAnimation",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/ResultScreen.svelte generated by Svelte v3.30.0 */
    const file$4 = "src/ResultScreen.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[11] = i;
    	return child_ctx;
    }

    // (105:1) {:else}
    function create_else_block_1(ctx) {
    	let p;
    	let t1;
    	let footsteps;
    	let current;
    	footsteps = new FootstepsAnimation({ $$inline: true });

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Calculating your route...";
    			t1 = space();
    			create_component(footsteps.$$.fragment);
    			attr_dev(p, "class", "font-bold text-lg text-center");
    			add_location(p, file$4, 105, 2, 3169);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(footsteps, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(footsteps.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(footsteps.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			destroy_component(footsteps, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(105:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (53:1) {#if libraries}
    function create_if_block$1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$1, create_else_block];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*libraries*/ ctx[0].length > 0) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(53:1) {#if libraries}",
    		ctx
    	});

    	return block;
    }

    // (87:2) {:else}
    function create_else_block(ctx) {
    	let p;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Nothing found for the address you selected.\n\t\t\t";
    			img = element("img");
    			attr_dev(p, "class", "font-bold text-lg text-center");
    			add_location(p, file$4, 87, 3, 2530);
    			if (img.src !== (img_src_value = "assets/person_with_map.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "max-w-md mx-auto my-4 w-full");
    			attr_dev(img, "alt", "woman holding a map");
    			add_location(img, file$4, 99, 7, 3034);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, img, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(87:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (54:2) {#if libraries.length > 0}
    function create_if_block_1$1(ctx) {
    	let resultsmap;
    	let t0;
    	let div1;
    	let ul;
    	let t1;
    	let div0;
    	let h3;
    	let t2_value = (/*libraries*/ ctx[0][/*selectedLibrary*/ ctx[4]].List_As_Name__c || /*libraries*/ ctx[0][/*selectedLibrary*/ ctx[4]].Library_Name__c) + "";
    	let t2;
    	let t3;
    	let p0;
    	let t4_value = /*libraries*/ ctx[0][/*selectedLibrary*/ ctx[4]].Street__c + "";
    	let t4;
    	let t5;
    	let p1;
    	let t6_value = (/*libraries*/ ctx[0][/*selectedLibrary*/ ctx[4]].Library_Story__c || "") + "";
    	let t6;
    	let current;

    	resultsmap = new ResultsMap({
    			props: {
    				selectedPlace: /*selectedPlace*/ ctx[1],
    				waypoints: /*waypoints*/ ctx[3],
    				selectedLibrary: /*libraryChosen*/ ctx[2]
    				? /*libraries*/ ctx[0][/*selectedLibrary*/ ctx[4]]
    				: null
    			},
    			$$inline: true
    		});

    	let each_value = /*libraries*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			create_component(resultsmap.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			div0 = element("div");
    			h3 = element("h3");
    			t2 = text(t2_value);
    			t3 = space();
    			p0 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			p1 = element("p");
    			t6 = text(t6_value);
    			attr_dev(ul, "class", "inline-block w-1/4 sm:w-5/12 divide-y divide-gray-300 overflow-x-hidden bg-gray-200");
    			add_location(ul, file$4, 59, 4, 1351);
    			attr_dev(h3, "class", "text-lg leading-none my-1 pb-1 border-b border-gray-300");
    			add_location(h3, file$4, 75, 5, 2102);
    			attr_dev(p0, "class", "text-xs uppercase tracking-wide text-gray-600");
    			add_location(p0, file$4, 78, 5, 2284);
    			attr_dev(p1, "class", "leading-tight");
    			add_location(p1, file$4, 81, 5, 2402);
    			attr_dev(div0, "class", "inline-block w-3/4 sm:w-7/12 px-3 md:px-6 py-3");
    			add_location(div0, file$4, 74, 4, 2036);
    			attr_dev(div1, "class", "rounded border border-gray-200 flex mt-4");
    			add_location(div1, file$4, 58, 3, 1292);
    		},
    		m: function mount(target, anchor) {
    			mount_component(resultsmap, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, h3);
    			append_dev(h3, t2);
    			append_dev(div0, t3);
    			append_dev(div0, p0);
    			append_dev(p0, t4);
    			append_dev(div0, t5);
    			append_dev(div0, p1);
    			append_dev(p1, t6);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const resultsmap_changes = {};
    			if (dirty & /*selectedPlace*/ 2) resultsmap_changes.selectedPlace = /*selectedPlace*/ ctx[1];
    			if (dirty & /*waypoints*/ 8) resultsmap_changes.waypoints = /*waypoints*/ ctx[3];

    			if (dirty & /*libraryChosen, libraries, selectedLibrary*/ 21) resultsmap_changes.selectedLibrary = /*libraryChosen*/ ctx[2]
    			? /*libraries*/ ctx[0][/*selectedLibrary*/ ctx[4]]
    			: null;

    			resultsmap.$set(resultsmap_changes);

    			if (dirty & /*selectedLibrary, libraryChosen, libraries, letters*/ 53) {
    				each_value = /*libraries*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if ((!current || dirty & /*libraries, selectedLibrary*/ 17) && t2_value !== (t2_value = (/*libraries*/ ctx[0][/*selectedLibrary*/ ctx[4]].List_As_Name__c || /*libraries*/ ctx[0][/*selectedLibrary*/ ctx[4]].Library_Name__c) + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty & /*libraries, selectedLibrary*/ 17) && t4_value !== (t4_value = /*libraries*/ ctx[0][/*selectedLibrary*/ ctx[4]].Street__c + "")) set_data_dev(t4, t4_value);
    			if ((!current || dirty & /*libraries, selectedLibrary*/ 17) && t6_value !== (t6_value = (/*libraries*/ ctx[0][/*selectedLibrary*/ ctx[4]].Library_Story__c || "") + "")) set_data_dev(t6, t6_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(resultsmap.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(resultsmap.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(resultsmap, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(54:2) {#if libraries.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (62:5) {#each libraries as lib, i}
    function create_each_block(ctx) {
    	let li;
    	let span;
    	let t0_value = /*letters*/ ctx[5][/*i*/ ctx[11]] + "";
    	let t0;
    	let t1;
    	let t2_value = (/*lib*/ ctx[9].List_As_Name__c || /*lib*/ ctx[9].Library_Name__c) + "";
    	let t2;
    	let t3;
    	let li_class_value;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[8](/*i*/ ctx[11]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
    			attr_dev(span, "class", "leading-none  w-4 inline-block text-center h-4 py-0.5 bg-red-500 text-gray-50 font-bold mr-1 text-xs rounded-full");
    			add_location(span, file$4, 68, 7, 1789);

    			attr_dev(li, "class", li_class_value = "cursor-pointer leading-none pl-2 py-2 overflow-hidden overflow-ellipsis whitespace-nowrap text-sm " + (/*selectedLibrary*/ ctx[4] === /*i*/ ctx[11]
    			? "bg-gray-50 shadow rounded-l"
    			: "shadow-inner"));

    			add_location(li, file$4, 62, 6, 1492);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, span);
    			append_dev(span, t0);
    			append_dev(li, t1);
    			append_dev(li, t2);
    			append_dev(li, t3);

    			if (!mounted) {
    				dispose = listen_dev(li, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*libraries*/ 1 && t2_value !== (t2_value = (/*lib*/ ctx[9].List_As_Name__c || /*lib*/ ctx[9].Library_Name__c) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*selectedLibrary*/ 16 && li_class_value !== (li_class_value = "cursor-pointer leading-none pl-2 py-2 overflow-hidden overflow-ellipsis whitespace-nowrap text-sm " + (/*selectedLibrary*/ ctx[4] === /*i*/ ctx[11]
    			? "bg-gray-50 shadow rounded-l"
    			: "shadow-inner"))) {
    				attr_dev(li, "class", li_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(62:5) {#each libraries as lib, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div0;
    	let current_block_type_index;
    	let if_block;
    	let div0_intro;
    	let div0_outro;
    	let t0;
    	let div1;
    	let button;
    	let svg;
    	let path;
    	let t1;
    	let div1_intro;
    	let div1_outro;
    	let current;
    	let mounted;
    	let dispose;
    	const if_block_creators = [create_if_block$1, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*libraries*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			if_block.c();
    			t0 = space();
    			div1 = element("div");
    			button = element("button");
    			svg = svg_element("svg");
    			path = svg_element("path");
    			t1 = text("Go\n\t\tback");
    			attr_dev(div0, "class", "max-w-2xl rounded-xl bg-gray-50 border border-gray-400 shadow-xl mx-2 sm:mx-10 md:mx-auto p-4 md:p-6 ");
    			add_location(div0, file$4, 48, 0, 915);
    			attr_dev(path, "stroke-linecap", "round");
    			attr_dev(path, "stroke-linejoin", "round");
    			attr_dev(path, "stroke-width", "2");
    			attr_dev(path, "d", "M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z");
    			add_location(path, file$4, 118, 38, 3689);
    			attr_dev(svg, "class", "w-6 h-6 inline-block mr-2 group-hover:text-indigo-800");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "stroke", "currentColor");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file$4, 113, 40, 3518);
    			attr_dev(button, "class", "group");
    			add_location(button, file$4, 113, 1, 3479);
    			attr_dev(div1, "class", "max-w-2xl rounded-xl bg-gray-50 border border-gray-400 shadow-xl mx-2 sm:mx-10 md:mx-auto px-4 md:px-6 py-2");
    			add_location(div1, file$4, 109, 0, 3270);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			if_blocks[current_block_type_index].m(div0, null);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, button);
    			append_dev(button, svg);
    			append_dev(svg, path);
    			append_dev(button, t1);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*reset*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div0, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);

    			add_render_callback(() => {
    				if (div0_outro) div0_outro.end(1);
    				if (!div0_intro) div0_intro = create_in_transition(div0, fly, { x: 300, duration: 200, delay: 200 });
    				div0_intro.start();
    			});

    			add_render_callback(() => {
    				if (div1_outro) div1_outro.end(1);
    				if (!div1_intro) div1_intro = create_in_transition(div1, fly, { x: 300, duration: 200, delay: 200 });
    				div1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			if (div0_intro) div0_intro.invalidate();
    			div0_outro = create_out_transition(div0, fly, { x: 300, duration: 200 });
    			if (div1_intro) div1_intro.invalidate();
    			div1_outro = create_out_transition(div1, fly, { x: 300, duration: 200 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div0_outro) div0_outro.end();
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			if (detaching && div1_outro) div1_outro.end();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ResultScreen", slots, []);
    	let { selectedPlace } = $$props;
    	let { showConfig } = $$props;
    	let { libraries } = $$props;
    	let libraryChosen = false;
    	let waypoints;
    	let selectedLibrary = 0;

    	const letters = [
    		"A",
    		"B",
    		"C",
    		"D",
    		"E",
    		"F",
    		"G",
    		"H",
    		"I",
    		"J",
    		"K",
    		"L",
    		"M",
    		"N",
    		"O",
    		"P",
    		"Q",
    		"R",
    		"S"
    	];

    	const reset = () => {
    		$$invalidate(0, libraries = undefined);
    		$$invalidate(4, selectedLibrary = 0);
    		$$invalidate(7, showConfig = true);
    	};

    	const writable_props = ["selectedPlace", "showConfig", "libraries"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ResultScreen> was created with unknown prop '${key}'`);
    	});

    	const click_handler = i => {
    		$$invalidate(4, selectedLibrary = i);
    		$$invalidate(2, libraryChosen = true);
    	};

    	$$self.$$set = $$props => {
    		if ("selectedPlace" in $$props) $$invalidate(1, selectedPlace = $$props.selectedPlace);
    		if ("showConfig" in $$props) $$invalidate(7, showConfig = $$props.showConfig);
    		if ("libraries" in $$props) $$invalidate(0, libraries = $$props.libraries);
    	};

    	$$self.$capture_state = () => ({
    		ResultsMap,
    		fly,
    		Footsteps: FootstepsAnimation,
    		selectedPlace,
    		showConfig,
    		libraries,
    		libraryChosen,
    		waypoints,
    		selectedLibrary,
    		letters,
    		reset
    	});

    	$$self.$inject_state = $$props => {
    		if ("selectedPlace" in $$props) $$invalidate(1, selectedPlace = $$props.selectedPlace);
    		if ("showConfig" in $$props) $$invalidate(7, showConfig = $$props.showConfig);
    		if ("libraries" in $$props) $$invalidate(0, libraries = $$props.libraries);
    		if ("libraryChosen" in $$props) $$invalidate(2, libraryChosen = $$props.libraryChosen);
    		if ("waypoints" in $$props) $$invalidate(3, waypoints = $$props.waypoints);
    		if ("selectedLibrary" in $$props) $$invalidate(4, selectedLibrary = $$props.selectedLibrary);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*libraries*/ 1) {
    			 {
    				if (libraries) {
    					$$invalidate(3, waypoints = libraries.map(r => {
    						const loc = r.Library_Geolocation__c;

    						return {
    							location: `${loc.latitude},${loc.longitude}`,
    							stopover: true
    						};
    					}));
    				}
    			}
    		}
    	};

    	return [
    		libraries,
    		selectedPlace,
    		libraryChosen,
    		waypoints,
    		selectedLibrary,
    		letters,
    		reset,
    		showConfig,
    		click_handler
    	];
    }

    class ResultScreen extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			selectedPlace: 1,
    			showConfig: 7,
    			libraries: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ResultScreen",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*selectedPlace*/ ctx[1] === undefined && !("selectedPlace" in props)) {
    			console.warn("<ResultScreen> was created without expected prop 'selectedPlace'");
    		}

    		if (/*showConfig*/ ctx[7] === undefined && !("showConfig" in props)) {
    			console.warn("<ResultScreen> was created without expected prop 'showConfig'");
    		}

    		if (/*libraries*/ ctx[0] === undefined && !("libraries" in props)) {
    			console.warn("<ResultScreen> was created without expected prop 'libraries'");
    		}
    	}

    	get selectedPlace() {
    		throw new Error("<ResultScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedPlace(value) {
    		throw new Error("<ResultScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showConfig() {
    		throw new Error("<ResultScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showConfig(value) {
    		throw new Error("<ResultScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get libraries() {
    		throw new Error("<ResultScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set libraries(value) {
    		throw new Error("<ResultScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var bind$1 = function bind(fn, thisArg) {
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };

    /*global toString:true*/

    // utils is a library of generic helper functions non-specific to axios

    var toString = Object.prototype.toString;

    /**
     * Determine if a value is an Array
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Array, otherwise false
     */
    function isArray(val) {
      return toString.call(val) === '[object Array]';
    }

    /**
     * Determine if a value is undefined
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if the value is undefined, otherwise false
     */
    function isUndefined(val) {
      return typeof val === 'undefined';
    }

    /**
     * Determine if a value is a Buffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Buffer, otherwise false
     */
    function isBuffer(val) {
      return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
        && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
    }

    /**
     * Determine if a value is an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an ArrayBuffer, otherwise false
     */
    function isArrayBuffer(val) {
      return toString.call(val) === '[object ArrayBuffer]';
    }

    /**
     * Determine if a value is a FormData
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an FormData, otherwise false
     */
    function isFormData(val) {
      return (typeof FormData !== 'undefined') && (val instanceof FormData);
    }

    /**
     * Determine if a value is a view on an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
     */
    function isArrayBufferView(val) {
      var result;
      if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
        result = ArrayBuffer.isView(val);
      } else {
        result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
      }
      return result;
    }

    /**
     * Determine if a value is a String
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a String, otherwise false
     */
    function isString(val) {
      return typeof val === 'string';
    }

    /**
     * Determine if a value is a Number
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Number, otherwise false
     */
    function isNumber(val) {
      return typeof val === 'number';
    }

    /**
     * Determine if a value is an Object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Object, otherwise false
     */
    function isObject(val) {
      return val !== null && typeof val === 'object';
    }

    /**
     * Determine if a value is a plain Object
     *
     * @param {Object} val The value to test
     * @return {boolean} True if value is a plain Object, otherwise false
     */
    function isPlainObject(val) {
      if (toString.call(val) !== '[object Object]') {
        return false;
      }

      var prototype = Object.getPrototypeOf(val);
      return prototype === null || prototype === Object.prototype;
    }

    /**
     * Determine if a value is a Date
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Date, otherwise false
     */
    function isDate(val) {
      return toString.call(val) === '[object Date]';
    }

    /**
     * Determine if a value is a File
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    function isFile(val) {
      return toString.call(val) === '[object File]';
    }

    /**
     * Determine if a value is a Blob
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Blob, otherwise false
     */
    function isBlob(val) {
      return toString.call(val) === '[object Blob]';
    }

    /**
     * Determine if a value is a Function
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Function, otherwise false
     */
    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }

    /**
     * Determine if a value is a Stream
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Stream, otherwise false
     */
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }

    /**
     * Determine if a value is a URLSearchParams object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a URLSearchParams object, otherwise false
     */
    function isURLSearchParams(val) {
      return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
    }

    /**
     * Trim excess whitespace off the beginning and end of a string
     *
     * @param {String} str The String to trim
     * @returns {String} The String freed of excess whitespace
     */
    function trim(str) {
      return str.replace(/^\s*/, '').replace(/\s*$/, '');
    }

    /**
     * Determine if we're running in a standard browser environment
     *
     * This allows axios to run in a web worker, and react-native.
     * Both environments support XMLHttpRequest, but not fully standard globals.
     *
     * web workers:
     *  typeof window -> undefined
     *  typeof document -> undefined
     *
     * react-native:
     *  navigator.product -> 'ReactNative'
     * nativescript
     *  navigator.product -> 'NativeScript' or 'NS'
     */
    function isStandardBrowserEnv() {
      if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                               navigator.product === 'NativeScript' ||
                                               navigator.product === 'NS')) {
        return false;
      }
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      );
    }

    /**
     * Iterate over an Array or an Object invoking a function for each item.
     *
     * If `obj` is an Array callback will be called passing
     * the value, index, and complete array for each item.
     *
     * If 'obj' is an Object callback will be called passing
     * the value, key, and complete object for each property.
     *
     * @param {Object|Array} obj The object to iterate
     * @param {Function} fn The callback to invoke for each item
     */
    function forEach(obj, fn) {
      // Don't bother if no value provided
      if (obj === null || typeof obj === 'undefined') {
        return;
      }

      // Force an array if not already something iterable
      if (typeof obj !== 'object') {
        /*eslint no-param-reassign:0*/
        obj = [obj];
      }

      if (isArray(obj)) {
        // Iterate over array values
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        // Iterate over object keys
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }

    /**
     * Accepts varargs expecting each argument to be an object, then
     * immutably merges the properties of each object and returns result.
     *
     * When multiple objects contain the same key the later object in
     * the arguments list will take precedence.
     *
     * Example:
     *
     * ```js
     * var result = merge({foo: 123}, {foo: 456});
     * console.log(result.foo); // outputs 456
     * ```
     *
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function merge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (isPlainObject(result[key]) && isPlainObject(val)) {
          result[key] = merge(result[key], val);
        } else if (isPlainObject(val)) {
          result[key] = merge({}, val);
        } else if (isArray(val)) {
          result[key] = val.slice();
        } else {
          result[key] = val;
        }
      }

      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }

    /**
     * Extends object a by mutably adding to it the properties of object b.
     *
     * @param {Object} a The object to be extended
     * @param {Object} b The object to copy properties from
     * @param {Object} thisArg The object to bind function to
     * @return {Object} The resulting value of object a
     */
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === 'function') {
          a[key] = bind$1(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }

    /**
     * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
     *
     * @param {string} content with BOM
     * @return {string} content value without BOM
     */
    function stripBOM(content) {
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      return content;
    }

    var utils = {
      isArray: isArray,
      isArrayBuffer: isArrayBuffer,
      isBuffer: isBuffer,
      isFormData: isFormData,
      isArrayBufferView: isArrayBufferView,
      isString: isString,
      isNumber: isNumber,
      isObject: isObject,
      isPlainObject: isPlainObject,
      isUndefined: isUndefined,
      isDate: isDate,
      isFile: isFile,
      isBlob: isBlob,
      isFunction: isFunction,
      isStream: isStream,
      isURLSearchParams: isURLSearchParams,
      isStandardBrowserEnv: isStandardBrowserEnv,
      forEach: forEach,
      merge: merge,
      extend: extend,
      trim: trim,
      stripBOM: stripBOM
    };

    function encode(val) {
      return encodeURIComponent(val).
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, '+').
        replace(/%5B/gi, '[').
        replace(/%5D/gi, ']');
    }

    /**
     * Build a URL by appending params to the end
     *
     * @param {string} url The base of the url (e.g., http://www.google.com)
     * @param {object} [params] The params to be appended
     * @returns {string} The formatted url
     */
    var buildURL = function buildURL(url, params, paramsSerializer) {
      /*eslint no-param-reassign:0*/
      if (!params) {
        return url;
      }

      var serializedParams;
      if (paramsSerializer) {
        serializedParams = paramsSerializer(params);
      } else if (utils.isURLSearchParams(params)) {
        serializedParams = params.toString();
      } else {
        var parts = [];

        utils.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === 'undefined') {
            return;
          }

          if (utils.isArray(val)) {
            key = key + '[]';
          } else {
            val = [val];
          }

          utils.forEach(val, function parseValue(v) {
            if (utils.isDate(v)) {
              v = v.toISOString();
            } else if (utils.isObject(v)) {
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + '=' + encode(v));
          });
        });

        serializedParams = parts.join('&');
      }

      if (serializedParams) {
        var hashmarkIndex = url.indexOf('#');
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }

        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }

      return url;
    };

    function InterceptorManager() {
      this.handlers = [];
    }

    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} An ID used to remove interceptor later
     */
    InterceptorManager.prototype.use = function use(fulfilled, rejected) {
      this.handlers.push({
        fulfilled: fulfilled,
        rejected: rejected
      });
      return this.handlers.length - 1;
    };

    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     */
    InterceptorManager.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };

    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     */
    InterceptorManager.prototype.forEach = function forEach(fn) {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };

    var InterceptorManager_1 = InterceptorManager;

    /**
     * Transform the data for a request or a response
     *
     * @param {Object|String} data The data to be transformed
     * @param {Array} headers The headers for the request or response
     * @param {Array|Function} fns A single function or Array of functions
     * @returns {*} The resulting transformed data
     */
    var transformData = function transformData(data, headers, fns) {
      /*eslint no-param-reassign:0*/
      utils.forEach(fns, function transform(fn) {
        data = fn(data, headers);
      });

      return data;
    };

    var isCancel = function isCancel(value) {
      return !!(value && value.__CANCEL__);
    };

    var normalizeHeaderName = function normalizeHeaderName(headers, normalizedName) {
      utils.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };

    /**
     * Update an Error with the specified config, error code, and response.
     *
     * @param {Error} error The error to update.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The error.
     */
    var enhanceError = function enhanceError(error, config, code, request, response) {
      error.config = config;
      if (code) {
        error.code = code;
      }

      error.request = request;
      error.response = response;
      error.isAxiosError = true;

      error.toJSON = function toJSON() {
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: this.config,
          code: this.code
        };
      };
      return error;
    };

    /**
     * Create an Error with the specified message, config, error code, request and response.
     *
     * @param {string} message The error message.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The created error.
     */
    var createError = function createError(message, config, code, request, response) {
      var error = new Error(message);
      return enhanceError(error, config, code, request, response);
    };

    /**
     * Resolve or reject a Promise based on response status.
     *
     * @param {Function} resolve A function that resolves the promise.
     * @param {Function} reject A function that rejects the promise.
     * @param {object} response The response.
     */
    var settle = function settle(resolve, reject, response) {
      var validateStatus = response.config.validateStatus;
      if (!response.status || !validateStatus || validateStatus(response.status)) {
        resolve(response);
      } else {
        reject(createError(
          'Request failed with status code ' + response.status,
          response.config,
          null,
          response.request,
          response
        ));
      }
    };

    var cookies = (
      utils.isStandardBrowserEnv() ?

      // Standard browser envs support document.cookie
        (function standardBrowserEnv() {
          return {
            write: function write(name, value, expires, path, domain, secure) {
              var cookie = [];
              cookie.push(name + '=' + encodeURIComponent(value));

              if (utils.isNumber(expires)) {
                cookie.push('expires=' + new Date(expires).toGMTString());
              }

              if (utils.isString(path)) {
                cookie.push('path=' + path);
              }

              if (utils.isString(domain)) {
                cookie.push('domain=' + domain);
              }

              if (secure === true) {
                cookie.push('secure');
              }

              document.cookie = cookie.join('; ');
            },

            read: function read(name) {
              var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
              return (match ? decodeURIComponent(match[3]) : null);
            },

            remove: function remove(name) {
              this.write(name, '', Date.now() - 86400000);
            }
          };
        })() :

      // Non standard browser env (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return {
            write: function write() {},
            read: function read() { return null; },
            remove: function remove() {}
          };
        })()
    );

    /**
     * Determines whether the specified URL is absolute
     *
     * @param {string} url The URL to test
     * @returns {boolean} True if the specified URL is absolute, otherwise false
     */
    var isAbsoluteURL = function isAbsoluteURL(url) {
      // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
      // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
      // by any combination of letters, digits, plus, period, or hyphen.
      return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
    };

    /**
     * Creates a new URL by combining the specified URLs
     *
     * @param {string} baseURL The base URL
     * @param {string} relativeURL The relative URL
     * @returns {string} The combined URL
     */
    var combineURLs = function combineURLs(baseURL, relativeURL) {
      return relativeURL
        ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
        : baseURL;
    };

    /**
     * Creates a new URL by combining the baseURL with the requestedURL,
     * only when the requestedURL is not already an absolute URL.
     * If the requestURL is absolute, this function returns the requestedURL untouched.
     *
     * @param {string} baseURL The base URL
     * @param {string} requestedURL Absolute or relative URL to combine
     * @returns {string} The combined full path
     */
    var buildFullPath = function buildFullPath(baseURL, requestedURL) {
      if (baseURL && !isAbsoluteURL(requestedURL)) {
        return combineURLs(baseURL, requestedURL);
      }
      return requestedURL;
    };

    // Headers whose duplicates are ignored by node
    // c.f. https://nodejs.org/api/http.html#http_message_headers
    var ignoreDuplicateOf = [
      'age', 'authorization', 'content-length', 'content-type', 'etag',
      'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
      'last-modified', 'location', 'max-forwards', 'proxy-authorization',
      'referer', 'retry-after', 'user-agent'
    ];

    /**
     * Parse headers into an object
     *
     * ```
     * Date: Wed, 27 Aug 2014 08:58:49 GMT
     * Content-Type: application/json
     * Connection: keep-alive
     * Transfer-Encoding: chunked
     * ```
     *
     * @param {String} headers Headers needing to be parsed
     * @returns {Object} Headers parsed into an object
     */
    var parseHeaders = function parseHeaders(headers) {
      var parsed = {};
      var key;
      var val;
      var i;

      if (!headers) { return parsed; }

      utils.forEach(headers.split('\n'), function parser(line) {
        i = line.indexOf(':');
        key = utils.trim(line.substr(0, i)).toLowerCase();
        val = utils.trim(line.substr(i + 1));

        if (key) {
          if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
            return;
          }
          if (key === 'set-cookie') {
            parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
          }
        }
      });

      return parsed;
    };

    var isURLSameOrigin = (
      utils.isStandardBrowserEnv() ?

      // Standard browser envs have full support of the APIs needed to test
      // whether the request URL is of the same origin as current location.
        (function standardBrowserEnv() {
          var msie = /(msie|trident)/i.test(navigator.userAgent);
          var urlParsingNode = document.createElement('a');
          var originURL;

          /**
        * Parse a URL to discover it's components
        *
        * @param {String} url The URL to be parsed
        * @returns {Object}
        */
          function resolveURL(url) {
            var href = url;

            if (msie) {
            // IE needs attribute set twice to normalize properties
              urlParsingNode.setAttribute('href', href);
              href = urlParsingNode.href;
            }

            urlParsingNode.setAttribute('href', href);

            // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
            return {
              href: urlParsingNode.href,
              protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
              host: urlParsingNode.host,
              search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
              hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
              hostname: urlParsingNode.hostname,
              port: urlParsingNode.port,
              pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                urlParsingNode.pathname :
                '/' + urlParsingNode.pathname
            };
          }

          originURL = resolveURL(window.location.href);

          /**
        * Determine if a URL shares the same origin as the current location
        *
        * @param {String} requestURL The URL to test
        * @returns {boolean} True if URL shares the same origin, otherwise false
        */
          return function isURLSameOrigin(requestURL) {
            var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
            return (parsed.protocol === originURL.protocol &&
                parsed.host === originURL.host);
          };
        })() :

      // Non standard browser envs (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return function isURLSameOrigin() {
            return true;
          };
        })()
    );

    var xhr = function xhrAdapter(config) {
      return new Promise(function dispatchXhrRequest(resolve, reject) {
        var requestData = config.data;
        var requestHeaders = config.headers;

        if (utils.isFormData(requestData)) {
          delete requestHeaders['Content-Type']; // Let the browser set it
        }

        var request = new XMLHttpRequest();

        // HTTP basic authentication
        if (config.auth) {
          var username = config.auth.username || '';
          var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
          requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
        }

        var fullPath = buildFullPath(config.baseURL, config.url);
        request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

        // Set the request timeout in MS
        request.timeout = config.timeout;

        // Listen for ready state
        request.onreadystatechange = function handleLoad() {
          if (!request || request.readyState !== 4) {
            return;
          }

          // The request errored out and we didn't get a response, this will be
          // handled by onerror instead
          // With one exception: request that using file: protocol, most browsers
          // will return status as 0 even though it's a successful request
          if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
            return;
          }

          // Prepare the response
          var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
          var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
          var response = {
            data: responseData,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config: config,
            request: request
          };

          settle(resolve, reject, response);

          // Clean up request
          request = null;
        };

        // Handle browser request cancellation (as opposed to a manual cancellation)
        request.onabort = function handleAbort() {
          if (!request) {
            return;
          }

          reject(createError('Request aborted', config, 'ECONNABORTED', request));

          // Clean up request
          request = null;
        };

        // Handle low level network errors
        request.onerror = function handleError() {
          // Real errors are hidden from us by the browser
          // onerror should only fire if it's a network error
          reject(createError('Network Error', config, null, request));

          // Clean up request
          request = null;
        };

        // Handle timeout
        request.ontimeout = function handleTimeout() {
          var timeoutErrorMessage = 'timeout of ' + config.timeout + 'ms exceeded';
          if (config.timeoutErrorMessage) {
            timeoutErrorMessage = config.timeoutErrorMessage;
          }
          reject(createError(timeoutErrorMessage, config, 'ECONNABORTED',
            request));

          // Clean up request
          request = null;
        };

        // Add xsrf header
        // This is only done if running in a standard browser environment.
        // Specifically not if we're in a web worker, or react-native.
        if (utils.isStandardBrowserEnv()) {
          // Add xsrf header
          var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
            cookies.read(config.xsrfCookieName) :
            undefined;

          if (xsrfValue) {
            requestHeaders[config.xsrfHeaderName] = xsrfValue;
          }
        }

        // Add headers to the request
        if ('setRequestHeader' in request) {
          utils.forEach(requestHeaders, function setRequestHeader(val, key) {
            if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
              // Remove Content-Type if data is undefined
              delete requestHeaders[key];
            } else {
              // Otherwise add header to the request
              request.setRequestHeader(key, val);
            }
          });
        }

        // Add withCredentials to request if needed
        if (!utils.isUndefined(config.withCredentials)) {
          request.withCredentials = !!config.withCredentials;
        }

        // Add responseType to request if needed
        if (config.responseType) {
          try {
            request.responseType = config.responseType;
          } catch (e) {
            // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
            // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
            if (config.responseType !== 'json') {
              throw e;
            }
          }
        }

        // Handle progress if needed
        if (typeof config.onDownloadProgress === 'function') {
          request.addEventListener('progress', config.onDownloadProgress);
        }

        // Not all browsers support upload events
        if (typeof config.onUploadProgress === 'function' && request.upload) {
          request.upload.addEventListener('progress', config.onUploadProgress);
        }

        if (config.cancelToken) {
          // Handle cancellation
          config.cancelToken.promise.then(function onCanceled(cancel) {
            if (!request) {
              return;
            }

            request.abort();
            reject(cancel);
            // Clean up request
            request = null;
          });
        }

        if (!requestData) {
          requestData = null;
        }

        // Send the request
        request.send(requestData);
      });
    };

    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    function setContentTypeIfUnset(headers, value) {
      if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }

    function getDefaultAdapter() {
      var adapter;
      if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = xhr;
      } else if (typeof {"env":{"GOOGLE_API_KEY":"AIzaSyA0ZY7KS7fMUyP05gzBWAjNWAjPU3pK3yw","SERVER":"https://lfl-walk.herokuapp.com"}} !== 'undefined' && Object.prototype.toString.call({"env":{"GOOGLE_API_KEY":"AIzaSyA0ZY7KS7fMUyP05gzBWAjNWAjPU3pK3yw","SERVER":"https://lfl-walk.herokuapp.com"}}) === '[object {"env":{"GOOGLE_API_KEY":"AIzaSyA0ZY7KS7fMUyP05gzBWAjNWAjPU3pK3yw","SERVER":"https://lfl-walk.herokuapp.com"}}]') {
        // For node use HTTP adapter
        adapter = xhr;
      }
      return adapter;
    }

    var defaults = {
      adapter: getDefaultAdapter(),

      transformRequest: [function transformRequest(data, headers) {
        normalizeHeaderName(headers, 'Accept');
        normalizeHeaderName(headers, 'Content-Type');
        if (utils.isFormData(data) ||
          utils.isArrayBuffer(data) ||
          utils.isBuffer(data) ||
          utils.isStream(data) ||
          utils.isFile(data) ||
          utils.isBlob(data)
        ) {
          return data;
        }
        if (utils.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils.isURLSearchParams(data)) {
          setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
          return data.toString();
        }
        if (utils.isObject(data)) {
          setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
          return JSON.stringify(data);
        }
        return data;
      }],

      transformResponse: [function transformResponse(data) {
        /*eslint no-param-reassign:0*/
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) { /* Ignore */ }
        }
        return data;
      }],

      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,

      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',

      maxContentLength: -1,
      maxBodyLength: -1,

      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      }
    };

    defaults.headers = {
      common: {
        'Accept': 'application/json, text/plain, */*'
      }
    };

    utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
      defaults.headers[method] = {};
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
    });

    var defaults_1 = defaults;

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }
    }

    /**
     * Dispatch a request to the server using the configured adapter.
     *
     * @param {object} config The config that is to be used for the request
     * @returns {Promise} The Promise to be fulfilled
     */
    var dispatchRequest = function dispatchRequest(config) {
      throwIfCancellationRequested(config);

      // Ensure headers exist
      config.headers = config.headers || {};

      // Transform request data
      config.data = transformData(
        config.data,
        config.headers,
        config.transformRequest
      );

      // Flatten headers
      config.headers = utils.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers
      );

      utils.forEach(
        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );

      var adapter = config.adapter || defaults_1.adapter;

      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);

        // Transform response data
        response.data = transformData(
          response.data,
          response.headers,
          config.transformResponse
        );

        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);

          // Transform response data
          if (reason && reason.response) {
            reason.response.data = transformData(
              reason.response.data,
              reason.response.headers,
              config.transformResponse
            );
          }
        }

        return Promise.reject(reason);
      });
    };

    /**
     * Config-specific merge-function which creates a new config-object
     * by merging two configuration objects together.
     *
     * @param {Object} config1
     * @param {Object} config2
     * @returns {Object} New object resulting from merging config2 to config1
     */
    var mergeConfig = function mergeConfig(config1, config2) {
      // eslint-disable-next-line no-param-reassign
      config2 = config2 || {};
      var config = {};

      var valueFromConfig2Keys = ['url', 'method', 'data'];
      var mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy', 'params'];
      var defaultToConfig2Keys = [
        'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
        'timeout', 'timeoutMessage', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
        'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'decompress',
        'maxContentLength', 'maxBodyLength', 'maxRedirects', 'transport', 'httpAgent',
        'httpsAgent', 'cancelToken', 'socketPath', 'responseEncoding'
      ];
      var directMergeKeys = ['validateStatus'];

      function getMergedValue(target, source) {
        if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
          return utils.merge(target, source);
        } else if (utils.isPlainObject(source)) {
          return utils.merge({}, source);
        } else if (utils.isArray(source)) {
          return source.slice();
        }
        return source;
      }

      function mergeDeepProperties(prop) {
        if (!utils.isUndefined(config2[prop])) {
          config[prop] = getMergedValue(config1[prop], config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          config[prop] = getMergedValue(undefined, config1[prop]);
        }
      }

      utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          config[prop] = getMergedValue(undefined, config2[prop]);
        }
      });

      utils.forEach(mergeDeepPropertiesKeys, mergeDeepProperties);

      utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          config[prop] = getMergedValue(undefined, config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          config[prop] = getMergedValue(undefined, config1[prop]);
        }
      });

      utils.forEach(directMergeKeys, function merge(prop) {
        if (prop in config2) {
          config[prop] = getMergedValue(config1[prop], config2[prop]);
        } else if (prop in config1) {
          config[prop] = getMergedValue(undefined, config1[prop]);
        }
      });

      var axiosKeys = valueFromConfig2Keys
        .concat(mergeDeepPropertiesKeys)
        .concat(defaultToConfig2Keys)
        .concat(directMergeKeys);

      var otherKeys = Object
        .keys(config1)
        .concat(Object.keys(config2))
        .filter(function filterAxiosKeys(key) {
          return axiosKeys.indexOf(key) === -1;
        });

      utils.forEach(otherKeys, mergeDeepProperties);

      return config;
    };

    /**
     * Create a new instance of Axios
     *
     * @param {Object} instanceConfig The default config for the instance
     */
    function Axios(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager_1(),
        response: new InterceptorManager_1()
      };
    }

    /**
     * Dispatch a request
     *
     * @param {Object} config The config specific for this request (merged with this.defaults)
     */
    Axios.prototype.request = function request(config) {
      /*eslint no-param-reassign:0*/
      // Allow for axios('example/url'[, config]) a la fetch API
      if (typeof config === 'string') {
        config = arguments[1] || {};
        config.url = arguments[0];
      } else {
        config = config || {};
      }

      config = mergeConfig(this.defaults, config);

      // Set config.method
      if (config.method) {
        config.method = config.method.toLowerCase();
      } else if (this.defaults.method) {
        config.method = this.defaults.method.toLowerCase();
      } else {
        config.method = 'get';
      }

      // Hook up interceptors middleware
      var chain = [dispatchRequest, undefined];
      var promise = Promise.resolve(config);

      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        chain.unshift(interceptor.fulfilled, interceptor.rejected);
      });

      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        chain.push(interceptor.fulfilled, interceptor.rejected);
      });

      while (chain.length) {
        promise = promise.then(chain.shift(), chain.shift());
      }

      return promise;
    };

    Axios.prototype.getUri = function getUri(config) {
      config = mergeConfig(this.defaults, config);
      return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
    };

    // Provide aliases for supported request methods
    utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, config) {
        return this.request(mergeConfig(config || {}, {
          method: method,
          url: url,
          data: (config || {}).data
        }));
      };
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, data, config) {
        return this.request(mergeConfig(config || {}, {
          method: method,
          url: url,
          data: data
        }));
      };
    });

    var Axios_1 = Axios;

    /**
     * A `Cancel` is an object that is thrown when an operation is canceled.
     *
     * @class
     * @param {string=} message The message.
     */
    function Cancel(message) {
      this.message = message;
    }

    Cancel.prototype.toString = function toString() {
      return 'Cancel' + (this.message ? ': ' + this.message : '');
    };

    Cancel.prototype.__CANCEL__ = true;

    var Cancel_1 = Cancel;

    /**
     * A `CancelToken` is an object that can be used to request cancellation of an operation.
     *
     * @class
     * @param {Function} executor The executor function.
     */
    function CancelToken(executor) {
      if (typeof executor !== 'function') {
        throw new TypeError('executor must be a function.');
      }

      var resolvePromise;
      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });

      var token = this;
      executor(function cancel(message) {
        if (token.reason) {
          // Cancellation has already been requested
          return;
        }

        token.reason = new Cancel_1(message);
        resolvePromise(token.reason);
      });
    }

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    CancelToken.prototype.throwIfRequested = function throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    };

    /**
     * Returns an object that contains a new `CancelToken` and a function that, when called,
     * cancels the `CancelToken`.
     */
    CancelToken.source = function source() {
      var cancel;
      var token = new CancelToken(function executor(c) {
        cancel = c;
      });
      return {
        token: token,
        cancel: cancel
      };
    };

    var CancelToken_1 = CancelToken;

    /**
     * Syntactic sugar for invoking a function and expanding an array for arguments.
     *
     * Common use case would be to use `Function.prototype.apply`.
     *
     *  ```js
     *  function f(x, y, z) {}
     *  var args = [1, 2, 3];
     *  f.apply(null, args);
     *  ```
     *
     * With `spread` this example can be re-written.
     *
     *  ```js
     *  spread(function(x, y, z) {})([1, 2, 3]);
     *  ```
     *
     * @param {Function} callback
     * @returns {Function}
     */
    var spread = function spread(callback) {
      return function wrap(arr) {
        return callback.apply(null, arr);
      };
    };

    /**
     * Create an instance of Axios
     *
     * @param {Object} defaultConfig The default config for the instance
     * @return {Axios} A new instance of Axios
     */
    function createInstance(defaultConfig) {
      var context = new Axios_1(defaultConfig);
      var instance = bind$1(Axios_1.prototype.request, context);

      // Copy axios.prototype to instance
      utils.extend(instance, Axios_1.prototype, context);

      // Copy context to instance
      utils.extend(instance, context);

      return instance;
    }

    // Create the default instance to be exported
    var axios = createInstance(defaults_1);

    // Expose Axios class to allow class inheritance
    axios.Axios = Axios_1;

    // Factory for creating new instances
    axios.create = function create(instanceConfig) {
      return createInstance(mergeConfig(axios.defaults, instanceConfig));
    };

    // Expose Cancel & CancelToken
    axios.Cancel = Cancel_1;
    axios.CancelToken = CancelToken_1;
    axios.isCancel = isCancel;

    // Expose all/spread
    axios.all = function all(promises) {
      return Promise.all(promises);
    };
    axios.spread = spread;

    var axios_1 = axios;

    // Allow use of default import syntax in TypeScript
    var _default = axios;
    axios_1.default = _default;

    var axios$1 = axios_1;

    const getPath = (origin, distance) => {
        return axios$1
            .get(`${{"env":{"GOOGLE_API_KEY":"AIzaSyA0ZY7KS7fMUyP05gzBWAjNWAjPU3pK3yw","SERVER":"https://lfl-walk.herokuapp.com"}}.env.SERVER}/path/${origin.lat}/${origin.lng}/${distance}`)
            .then((response) => {
            return response.data;
        });
    };

    /* src/App.svelte generated by Svelte v3.30.0 */
    const file$5 = "src/App.svelte";

    // (34:1) {:else}
    function create_else_block$1(ctx) {
    	let resultscreen;
    	let updating_selectedPlace;
    	let updating_libraries;
    	let updating_showConfig;
    	let current;

    	function resultscreen_selectedPlace_binding(value) {
    		/*resultscreen_selectedPlace_binding*/ ctx[6].call(null, value);
    	}

    	function resultscreen_libraries_binding(value) {
    		/*resultscreen_libraries_binding*/ ctx[7].call(null, value);
    	}

    	function resultscreen_showConfig_binding(value) {
    		/*resultscreen_showConfig_binding*/ ctx[8].call(null, value);
    	}

    	let resultscreen_props = {};

    	if (/*selectedPlace*/ ctx[1] !== void 0) {
    		resultscreen_props.selectedPlace = /*selectedPlace*/ ctx[1];
    	}

    	if (/*libraries*/ ctx[2] !== void 0) {
    		resultscreen_props.libraries = /*libraries*/ ctx[2];
    	}

    	if (/*showConfig*/ ctx[3] !== void 0) {
    		resultscreen_props.showConfig = /*showConfig*/ ctx[3];
    	}

    	resultscreen = new ResultScreen({
    			props: resultscreen_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(resultscreen, "selectedPlace", resultscreen_selectedPlace_binding));
    	binding_callbacks.push(() => bind(resultscreen, "libraries", resultscreen_libraries_binding));
    	binding_callbacks.push(() => bind(resultscreen, "showConfig", resultscreen_showConfig_binding));

    	const block = {
    		c: function create() {
    			create_component(resultscreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(resultscreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const resultscreen_changes = {};

    			if (!updating_selectedPlace && dirty & /*selectedPlace*/ 2) {
    				updating_selectedPlace = true;
    				resultscreen_changes.selectedPlace = /*selectedPlace*/ ctx[1];
    				add_flush_callback(() => updating_selectedPlace = false);
    			}

    			if (!updating_libraries && dirty & /*libraries*/ 4) {
    				updating_libraries = true;
    				resultscreen_changes.libraries = /*libraries*/ ctx[2];
    				add_flush_callback(() => updating_libraries = false);
    			}

    			if (!updating_showConfig && dirty & /*showConfig*/ 8) {
    				updating_showConfig = true;
    				resultscreen_changes.showConfig = /*showConfig*/ ctx[3];
    				add_flush_callback(() => updating_showConfig = false);
    			}

    			resultscreen.$set(resultscreen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(resultscreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(resultscreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(resultscreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(34:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (32:1) {#if showConfig}
    function create_if_block$2(ctx) {
    	let configscreen;
    	let updating_selectedPlace;
    	let current;

    	function configscreen_selectedPlace_binding(value) {
    		/*configscreen_selectedPlace_binding*/ ctx[5].call(null, value);
    	}

    	let configscreen_props = {
    		pathToMap: /*pathToMap*/ ctx[4],
    		mapReady: /*mapReady*/ ctx[0]
    	};

    	if (/*selectedPlace*/ ctx[1] !== void 0) {
    		configscreen_props.selectedPlace = /*selectedPlace*/ ctx[1];
    	}

    	configscreen = new ConfigScreen({
    			props: configscreen_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(configscreen, "selectedPlace", configscreen_selectedPlace_binding));

    	const block = {
    		c: function create() {
    			create_component(configscreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(configscreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const configscreen_changes = {};
    			if (dirty & /*mapReady*/ 1) configscreen_changes.mapReady = /*mapReady*/ ctx[0];

    			if (!updating_selectedPlace && dirty & /*selectedPlace*/ 2) {
    				updating_selectedPlace = true;
    				configscreen_changes.selectedPlace = /*selectedPlace*/ ctx[1];
    				add_flush_callback(() => updating_selectedPlace = false);
    			}

    			configscreen.$set(configscreen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(configscreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(configscreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(configscreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(32:1) {#if showConfig}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let script;
    	let script_src_value;
    	let t0;
    	let header;
    	let nav;
    	let img;
    	let img_src_value;
    	let t1;
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let t2;
    	let footer;
    	let a;
    	let svg;
    	let path;
    	let t3;
    	let current;
    	const if_block_creators = [create_if_block$2, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*showConfig*/ ctx[3]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			script = element("script");
    			t0 = space();
    			header = element("header");
    			nav = element("nav");
    			img = element("img");
    			t1 = space();
    			main = element("main");
    			if_block.c();
    			t2 = space();
    			footer = element("footer");
    			a = element("a");
    			svg = svg_element("svg");
    			path = svg_element("path");
    			t3 = text("\n\t\tstar on Github");
    			script.defer = true;
    			script.async = true;

    			if (script.src !== (script_src_value = `https://maps.googleapis.com/maps/api/js?key=${({
				"env": {
					"GOOGLE_API_KEY": "AIzaSyA0ZY7KS7fMUyP05gzBWAjNWAjPU3pK3yw",
					"SERVER": "https://lfl-walk.herokuapp.com"
				}
			}).env.GOOGLE_API_KEY}&callback=initMap&libraries=places,directions`)) attr_dev(script, "src", script_src_value);

    			add_location(script, file$5, 16, 1, 465);
    			if (img.src !== (img_src_value = "assets/logo.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Little Free Library Walk");
    			attr_dev(img, "class", "w-48");
    			add_location(img, file$5, 27, 2, 923);
    			attr_dev(nav, "class", "max-w-2xl mx-2 sm:mx-10 md:mx-auto");
    			add_location(nav, file$5, 26, 1, 872);
    			attr_dev(header, "class", "flex-initial pt-4 md:pt-8 pb-28 md:pb-32 bg-gradient-to-r from-indigo-900 to-fuchsia-900 text-gray-50");
    			add_location(header, file$5, 23, 0, 750);
    			attr_dev(main, "class", "flex-1 -mt-24 space-y-2");
    			add_location(main, file$5, 30, 0, 1015);
    			attr_dev(path, "d", "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z");
    			add_location(path, file$5, 49, 4, 1625);
    			attr_dev(svg, "class", "w-4 h-4 inline-block mr-1 group-hover:text-yellow-300");
    			attr_dev(svg, "fill", "currentColor");
    			attr_dev(svg, "viewBox", "0 0 20 20");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file$5, 44, 2, 1467);
    			attr_dev(a, "class", "max-w-2xl mx-2 sm:mx-10 md:mx-auto py-4 block text-sm group");
    			attr_dev(a, "href", "https://github.com/lauraschultz/little-free-library-walk");
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "rel", "noreferer");
    			add_location(a, file$5, 38, 1, 1287);
    			attr_dev(footer, "class", "flex-initial bg-gray-700 text-gray-50 mt-5");
    			add_location(footer, file$5, 37, 0, 1226);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, script);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, header, anchor);
    			append_dev(header, nav);
    			append_dev(nav, img);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, main, anchor);
    			if_blocks[current_block_type_index].m(main, null);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, a);
    			append_dev(a, svg);
    			append_dev(svg, path);
    			append_dev(a, t3);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(main, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(script);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(main);
    			if_blocks[current_block_type_index].d();
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let { mapReady } = $$props;
    	let selectedPlace;
    	let libraries;
    	let showConfig = true;

    	const pathToMap = (selectedPlace, distance) => {
    		$$invalidate(3, showConfig = false);

    		getPath(selectedPlace, distance).then(result => {
    			$$invalidate(2, libraries = result);
    		});
    	};

    	const writable_props = ["mapReady"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function configscreen_selectedPlace_binding(value) {
    		selectedPlace = value;
    		$$invalidate(1, selectedPlace);
    	}

    	function resultscreen_selectedPlace_binding(value) {
    		selectedPlace = value;
    		$$invalidate(1, selectedPlace);
    	}

    	function resultscreen_libraries_binding(value) {
    		libraries = value;
    		$$invalidate(2, libraries);
    	}

    	function resultscreen_showConfig_binding(value) {
    		showConfig = value;
    		$$invalidate(3, showConfig);
    	}

    	$$self.$$set = $$props => {
    		if ("mapReady" in $$props) $$invalidate(0, mapReady = $$props.mapReady);
    	};

    	$$self.$capture_state = () => ({
    		mapReady,
    		ConfigScreen,
    		ResultScreen,
    		getPath,
    		selectedPlace,
    		libraries,
    		showConfig,
    		pathToMap
    	});

    	$$self.$inject_state = $$props => {
    		if ("mapReady" in $$props) $$invalidate(0, mapReady = $$props.mapReady);
    		if ("selectedPlace" in $$props) $$invalidate(1, selectedPlace = $$props.selectedPlace);
    		if ("libraries" in $$props) $$invalidate(2, libraries = $$props.libraries);
    		if ("showConfig" in $$props) $$invalidate(3, showConfig = $$props.showConfig);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		mapReady,
    		selectedPlace,
    		libraries,
    		showConfig,
    		pathToMap,
    		configscreen_selectedPlace_binding,
    		resultscreen_selectedPlace_binding,
    		resultscreen_libraries_binding,
    		resultscreen_showConfig_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { mapReady: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*mapReady*/ ctx[0] === undefined && !("mapReady" in props)) {
    			console.warn("<App> was created without expected prop 'mapReady'");
    		}
    	}

    	get mapReady() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mapReady(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
        target: document.body,
        props: {
            mapReady: false,
        },
    });
    window.initMap = function ready() {
        console.log(`maps api ready.`);
        app.$set({ mapReady: true });
    };

    return app;

}());
//# sourceMappingURL=bundle.js.map
