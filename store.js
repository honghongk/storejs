/**
 * TODO: 나중에 btree 구현 ㄱㄱ
 * 문자를 숫자로 -> strcmp 같은 함수 ㄱㄱ
 * 근데 js는 문자끼리 비교연산 하면 된다고함
 * 
 * TODO: index 클래스 따로하기
 * index 여러개 하기
 * 
 * TODO: where 를 배열로
 * {column: 'name', operator: '>', value: ''}
 * 
 */
(function (global, factory) {

    // 네임스페이스
    // global ??= {};

    // 의존성
    let requires = {
        Index: global.Store.Index
    };

    if ( global.constructor.name == 'Window' )
    {
        let lib = factory(requires);
        for (const k in lib)
            global[k] = lib[k];
    }

    if ( typeof exports === 'object' && typeof module !== 'undefined')
        module.exports = factory(requires);
    else if ( typeof define === 'function' && define.amd )
        define(factory);

}(globalThis, (function (req) { 'use strict';


    let { Index } = req;

    let priv = {

        // 배열만
        data: new WeakMap(),

        // 데이터 몇개 들어있는지 저장, insert + delete -
        count: new WeakMap(),

        event: new WeakMap(),

        // pk
        primaryKey: new WeakMap(),

        // index
        key: new WeakMap(),

        // 메서드별 싱크 설정
        sync: new WeakMap(),

        attach: new WeakMap(),

        // row 오브젝트 : html 태그
        // TODO: 여러군데, 여러 attach 가능하도록 해야함
        // TODO: {row: { target: html }}
        elementMap: new WeakMap(),

        // 렌더시 셀렉조건
        filter: new WeakMap(),

        // API CRUD 별 호출
        api: new WeakMap(),
    };

    let setup = {

        /**
         * 백엔드 API 연결 콜백
         */
        api: function(k, v){
            let api = priv.api.get(this) ?? {};

            // getter
            if ( arguments.length == 0 )
                return api;

            if ( arguments.length == 1 )
            {
                // getter
                if ( typeof k == 'string')
                    return api[k];

                // setter
                api = k;
            }
            else if ( arguments.length == 2 )
            {
                api[k] = v;
            }

            // 설정 가능한 키 검사
            let able = ['select', 'insert', 'update', 'delete'];
            for (const k of Object.keys(api))
            {
                if ( ! able.includes(k) )
                    throw new Error(`설정할 수 없는 키: ${k}`);
            }
            
            priv.api.set(this, api);
            return this;
        },
        /**
         * 렌더링 조건
         * select 와 같음
         * @return {where = {}, orderby = [], offset = 0, length = 0}
         */
        filter: function(k, v){
            let filter = structuredClone( priv.filter.get(this) ?? {} );

            // getter
            if ( arguments.length == 0 )
                return filter;

            if ( arguments.length == 1 )
            {
                // getter
                if ( typeof k == 'string')
                    return filter[k];

                // setter
                filter = k;
            }
            else if ( arguments.length == 2 )
            {
                filter[k] = v;
            }

            // 설정 가능한 키 검사
            let able = ['where', 'orderby', 'offset', 'length'];
            for (const k of Object.keys(filter))
            {
                if ( ! able.includes(k) )
                    throw new Error(`설정할 수 없는 키: ${k}`);
            }
            
            priv.filter.set(this, filter);
            return this;
        },

        /**
         * pk 세팅
         * @param {String|Array|Object} v 
         *          String: "colname"
         *          Array: ["colname" ... ]
         *          Object: { type: "binary_search", delimiter: ":", column: ["colname" ...] }
         * @returns 
         */
        primaryKey: function(v){
            let pk = priv.primaryKey.get(this);
            if ( arguments.length == 0 )
                return pk;

            pk = new Index(v);
            pk.unique(true);
            priv.primaryKey.set(this, pk);
            pk.remap(this.data());
            return this;
        },

        /**
         * 키 매핑
         * @param {String} k 인덱스 이름
         * @param {String|Array} v 인덱스 설정값
         * @returns 
         */
        key: function(k, v){
            let key = priv.key.get(this) ?? {};
            if ( arguments.length == 0 )
                return key;

            if ( arguments.length == 1 )
            {
                if ( typeof k == 'string' )
                    return key[k];
                else
                    for (const kk in k)
                        key[kk] = new Index(k[kk]);
            }

            if ( arguments.length == 2 )
                key[k] = new Index(v);

            priv.key.set(this, key);
            for (const kk in key)
                key[kk].remap(this.data());
            return this;
        },

        /**
         * 데이터 객체 초기화
         * @param {Array} v 데이터 객체 []
         * @returns {Array}
         */
        data: function(v){
            let data = priv.data.get(this);
            if ( arguments.length == 0 )
                return data;

            data = v;
            priv.data.set(this, data);
            priv.count.set(this, data.length);
            this._remap();

            // 렌더링 초기화
            let attach = this.attach();
            if ( attach )
            {
                let target = document.querySelector(attach.target);
                target.innerHTML = '';
            }
            return this;
        },

        /**
         * 메서드별 싱크 설정
         * @param {*} v {method: act|ajax} 
         */
        sync: function(v){

            let sync = priv.sync.get(this);
            if ( arguments.length == 0 )
                return sync;

            if ( typeof v !== 'object' || v === null )
                throw new Error('sync는 객체여야 합니다');

            let ak = Object.keys(action);
            // 메서드별 싱크 설정
            for (const k in v)
            {
                if ( ! ak.includes(k) )
                    throw new Error(`sync 설정은 ${ak.join(', ')} 만 가능합니다: ${k}`);
            }

            sync = v;
            priv.sync.set(this, sync);
            return this;
        },

        /**
         * 단일 세팅
         * @param {Object} v {target: selector, template: function}
         */
        attach: function(v){
            let attach = priv.attach.get(this);
            if ( arguments.length == 0 )
            {
                if ( typeof attach != 'undefined' )
                {
                    attach.clear ??= false;
                    attach.mode ??= 'append';
                }
                return attach;
            }

            attach = v;
            priv.attach.set(this, attach);
            return this;
        },

        /**
         * TODO: 이미있는거 비우고 해야할까?
         */
        event: function(event){
            for (const k in event)
                this.on(k, event[k]);
            return this;
        },

    };

    let method = {

        /**
         * 이벤트 추가
         * @param {String} k 이벤트 이름
         * @param {*} func 
         * @returns 
         */
        on: function(k, func) {
            let event = priv.event.get(this) ?? {};
            event[k] ??= [];
            event[k].push(func);
            priv.event.set(this, event);
            return this;
        },

        /**
         * 이벤트 해제
         * @param {String} k 이벤트 이름
         * @param {*} func 
         * @returns 
         */
        off: function(k, func) {
            let arr = priv.event.get(this)?.[k];
            if (!arr)
                return this;
            if (!func)
                priv.event.get(this)[k] = [];
            else
                priv.event.get(this)[k] = arr.filter(h => h !== func);
            return this;
        },

        dispatch: function(event, ...args) {
            let act = priv.event.get(this)?.[event] ?? [];
            for (const a of act)
                a.apply(this, args);
            return this;
        },

        get count(){
            return priv.count.get(this) ?? 0;
        },
        get length(){
            return priv.count.get(this) ?? 0;
        },

        /**
         * 키가 매치하는지 확인
         * @param {*} key 
         * @param {*} where 
         * @returns bool
         */
        // _matchKey: function(key, where){
        //     let wk = Object.keys(where);
        //     wk.sort();
        //     return arrayEqual(key, wk);
        // },

        /**
         * GPT가 만들어줌, 연산자 처리
         * @param {*} value 
         * @param {*} operator 
         * @param {*} operand 
         * @returns 
         */
        _applyOperator: function(value, operator, operand) {
            switch (operator) {
                case '$like':
                    
                    let pattern = '^' + operand
                        .replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1')
                        .replace(/%/g, '.*') + '$';
                    let regex = new RegExp(pattern, 'i');
                    return regex.test(value);
                case '$eq':
                case '=':
                    return value == operand;
                case '$ne':
                case '!=':
                    return value != operand;
                case '$gt':
                case '>':
                    return value > operand;
                case '$gte':
                case '>=':
                    return value >= operand;
                case '$lt':
                case '<':
                    return value < operand;
                case '$lte':
                case '<=':
                    return value <= operand;
                case '$in':
                    return operand.includes(value);
                case '$nin':
                    return !operand.includes(value);
                // operand는 [min, max] 형태
                case '$between':
                    if ( ! Array.isArray(operand) || operand.length < 2)
                        return false;
                    return value >= operand[0] && value <= operand[1];
                case '$nbetween':
                    if ( ! Array.isArray(operand) || operand.length < 2)
                        return false;
                    return !(value >= operand[0] && value <= operand[1]);
                default:
                    return false;
            }
        },

        /**
         * GPT가 만들어줌
         * 한줄 매치 체크
         * @param {*} row 
         * @param {*} where 
         * @returns 
         */
        _matchRow: function(row, where) {
            return Object.entries(where).every(([key, condition]) => {
                // 논리 연산자 처리
                if (key === '$or') {
                    return condition.some(sub => this._matchRow(row, sub));
                }
                if (key === '$and') {
                    return condition.every(sub => this._matchRow(row, sub));
                }
                if (key === '$not') {
                    return ! this._matchRow(row, condition);
                }

                // 논리연산자 없으면 $eq $like 취급으로
                if ( typeof condition !== 'object' && condition !== null )
                {
                    condition = condition.includes('%')
                        ? { $like: condition }
                        : { $eq: condition } ;
                }

                // 값이 함수일 경우
                if (typeof condition === 'function') {
                    return condition(row[key]);
                }

                // 연산자 객체일 경우 ({ $gte: 20, $nin: [...] })
                // FIX: empty 값일때 처리 필요함
                if (typeof condition === 'object' && condition !== null) {
                    return Object.entries(condition).every(([op, val]) => {
                        return this._applyOperator(row[key], op, val)
                    });
                }

                // 단순 값 비교
                return row[key] == condition;
            });
        },

        /**
         * pk, key와 where 조건에 맞는 타겟 얻기
         * @param {*} where 
         * @returns 
         */
        _getTarget: function(where){
            
            // 데이터
            let list = this.data();

            // 스캔 타겟
            let target = [];

            // 키에 있는값들은 전부 where에 있긴 해야함
            let pk = this.primaryKey();
            let key = this.key();
            let isKey = false;

            // pk 찾은값 있으면 결과에 추가
            if ( pk && pk._includeKey(where) )
            {
                isKey = true;
                let ff = pk.find(where, list);
                for (const r of ff)
                {
                    let pkv = pk._getKeyValue(r);
                    target[pkv] = r;
                }
            }

            // k 찾은 값 있으면 결과에 추가
            if ( key && Object.keys(key).length > 0 )
            {
                for (const k in key)
                {
                    if ( ! key[k]._includeKey(where) )
                        continue;
                    isKey = true;

                    let ff = key[k].find(where, list);
                    for (const r of ff)
                    {
                        let kv = key[k]._getKeyValue(r);
                        target[kv] = r;
                    }
                }
            }
            // 키 없으면 전체
            if ( ! isKey )
                target = list;

            let res = {};
            // where 조건에 맞는것 담기
            for (const k in target)
            {
                let row = target[k];
                // 없는것도 일단 포함 시키고 select에서 페이징 이후 거르기
                if ( typeof row == 'undefined' || ! this._matchRow(row, where) )
                    continue;

                let pkv = pk._getKeyValue(row);
                res[pkv] = row;
            }

            return res;
        },

        /**
         * 매핑다시
         */
        _remap: function(){
            let data = this.data();

            // 데이터 없으면 안함
            if ( ! data )
                return this;

            let pk = this.primaryKey();
            if ( pk )
                pk.remap(data);

            let key = this.key();
            for (const k in key)
                key[k].remap(data);

            return this;
        },
        /**
         * insert or update 처리
         * pk 겹치면 덮어쓰는거로
         * TODO: 나중에 unique key 같은거 생기면 그거로도 덮어쓰기
         */
        set: function(row){

            // 키
            let pk = this.primaryKey();
            let key = this.key();

            console.log('### set ???')
            if ( pk.hasMap(row) )
            {
                console.log('set 메서드에서 덮어쓰기 구현 다시 ㄱㄱ');
                // pk.setMap(row);
                // this.update(row);
            }
            else
                return this.insert(row);
        },

    };
    let action = {

        /**
         * 
         * @param {*} row 
         * @returns {Number} offset
         */
        insert: async function(row){

            let api = this.api('insert');
            if ( api )
                await api( row );

            // 키
            let pk = this.primaryKey();
            let key = this.key();

            if ( pk && pk.hasMap(row) && pk.unique() )
                throw new Error(`데이터 중복 ㅇㅇ`);

            for (const k in key)
            {
                if ( key[k].hasMap(row) && key[k].unique() )
                    throw new Error(`데이터 중복 ㅇㅇ`);
            }

            let pkv = pk._getKeyValue(row);
            let data = this.data();
            data[pkv] = row;

            if ( pk )
                pk.setMap(row, pkv);
            for (const k in key)
                key[k].setMap(row, pkv);

            priv.count.set(this, this.count + 1);

            return pkv;
        },

        /**
         * 수정
         * @param {*} 데이터
         * @param {Object} 데이터 조건, 일치만
         */
        update: async function (data, where = {}) {

            let api = this.api('update');
            if ( api )
                await api( data, where );
            // await this.api('update')(data, where);

            // 키 가져오기
            let totalData = this.data();
            let pk = this.primaryKey();
            let key = this.key();

            // 조건에 맞는 값들
            let target = this._getTarget(where);

            // pk는 여러개 못바꾸고 하나만 바꿀 수 있음
            if ( target.length > 1 && pk._includeKey(pk, data) )
                throw new Error('pk 중복 업데이트');

            let updated = [];
            for (const k in target)
            {
                let row = target[k];
                let copy = structuredClone(row);

                // 변경된것만 수정
                let upd = {};
                for (const k in data)
                {
                    if ( row[k] === data[k] )
                        continue;
                    copy[k] = data[k];
                    upd[k] = data[k];
                }

                // 변경된게 있는거 기록
                if ( Object.keys(upd).length > 0 )
                {
                    updated.push(upd);

                    // pk 적용
                    if ( pk._includeKey(upd) )
                    {
                        pk.delMap(row, totalData.indexOf(row));
                        pk.setMap(row, totalData.indexOf(copy));
                    }

                    // 키 적용
                    for (const kname in key)
                    {
                        let k = key[kname];
                        if ( k._includeKey(key, upd) )
                        {
                            k.delMap(totalData.indexOf(row));
                            k.setMap(totalData.indexOf(copy));
                        }
                    }

                    // 덮어쓰기
                    for (const k in copy)
                        row[k] = copy[k];
                }
            }

            return updated;
        },

        /**
         * 조건에맞는것 삭제
         */
        delete: async function(where = {}){

            let api = this.api('delete');
            if ( api )
                await api( where );
            // await this.api('delete')(where);

            // 조건 매칭된 대상들
            let target = this._getTarget(where);

            if ( target.length === 0 )
                return [];

            let removed = [];
            let data = this.data();
            let elMap = priv.elementMap.get(this);
            let pk = this.primaryKey();
            let key = this.key();

            for (const k in target)
            {
                let row = target[k];
                // 렌더된 엘리먼트 제거
                let el = elMap.get(row);
                if (el)
                {
                    for (const e of el)
                        e.remove();
                    elMap.delete(row);
                }

                // pk 적용
                let pkv = pk._getKeyValue(row);
                pk.delMap(row, pkv);

                // 키 적용
                for (const kname in key)
                {
                    let k = key[kname];
                    if ( k._includeKey(key, upd) )
                    {
                        let kv = k._getKeyValue(row);
                        k.delMap(row, kv);
                    }
                }

                // 3. 데이터 제거
                delete data[pkv] ;
                removed.push(pkv);
            }

            // 4. 카운트 갱신
            priv.count.set(this, data.length);

            return removed;
        },

        /**
         * 데이터 얻기
         */
        select: async function({where = {}, orderby = [], offset = 0, length = 0} = {}){

            // 조건에 맞는 값들
            let res = this._getTarget(where);
            let pk = this.primaryKey();
            let current = this.data();

            this.selectInfo = {
                count: res.length,
            };

            // 조건 맞는 PK 배열
            let selectedKey = Object.keys(res);

            // 정렬
            if (orderby.length > 0)
            {
                selectedKey.sort((ka, kb) => {
                    const a = res[ka];
                    const b = res[kb];

                    for (const o of orderby)
                    {
                        const col = o.column;
                        const dir = o.type?.toLowerCase() === 'desc' ? -1 : 1;

                        const va = a[col];
                        const vb = b[col];

                        if (va === undefined && vb === undefined) continue;
                        if (va === undefined) return 1 * dir;
                        if (vb === undefined) return -1 * dir;

                        if (va < vb) return -1 * dir;
                        if (va > vb) return 1 * dir;
                    }
                    return 0;
                });
            }

            // 페이징
            if (length > 0)
                selectedKey = selectedKey.slice(offset, offset + length);
            else if (offset > 0)
                selectedKey = selectedKey.slice(offset);

            let selected = [];
            for (const k of selectedKey)
                selected.push(res[k]);
            res = selected;

            // 빈공간 확인
            let needFetch = selectedKey.length < length;
            // autoincrement 일때만
            if ( ! needFetch )
            {
                let kk = Object.keys(current);
                let min = Math.min(... kk);
                let max = Math.max(... kk);
                for (let i = min; i <= max; i++)
                {
                    if ( ! current[i] )
                    {
                        needFetch = true;
                        break;
                    }
                }
            }

            // console.log('호출 감지 ??', res.includes(undefined) || res.length < length,res.includes(undefined) , res.length, length)
            // 오프셋 빠진거 있다면 가져오기
            if ( needFetch )
            {
                let api = this.api('select');

                let newdata = [];
                if ( api )
                    newdata = await api( ... arguments );
                else
                    return res;

                // 일단은 row 각각에 집어넣기 ㄱㄱ
                for (const row of newdata)
                {
                    let pkv = pk._getKeyValue(row);
                    current[pkv] = row;
                }
                this._remap();

                this.selectInfo.count = newdata.length;

                return newdata;
            }

            return res;
        },


        /**
         * 내부 한줄씩 렌더링
         */
        _render: function(row){

            let attach = this.attach();

            // 템플릿 없으면 스킵
            if ( !(attach.template instanceof Function) )
                return;

            let map = priv.elementMap.get(this) ?? new WeakMap();
            // TODO: 여러군데 넣어도 괜찮게 ㄱㄱ
            let target = document.querySelector(attach.target);

            let el = map.get(row);

            // 엘리먼트 생성
            if ( ! el )
            {
                el = Store.toElement(attach.template(row));
                map.set(row, el);
            }
            // 엘리먼트 비교, 수정
            else
            {
                let newe = Store.toElement(attach.template(row));
                Store.patchElement(el, newe);
                // throw '기존 엘리먼트 있음';
            }

            // mode 에 맞게 element 적용
            for (const e of el)
                target[attach.mode](e);

            // 엘리먼트 맵 저장
            priv.elementMap.set(this, map);

            return this;
        },

        /**
         * 전체 렌더링
         * 저장된 조건으로 렌더링 하기
         */
        render: async function () {
            // 이미 예약 걸려있으면 스킵
            if ( this._renderScheduled )
                return this;

            this._renderScheduled = true;

            requestAnimationFrame(() => {
                // TODO: settimeout 이거 말고 없을란가? 완전 동기적으로 돌게끔?
                setTimeout(async () => {

                    this._renderScheduled = false;
    
                    let filter = this.filter();
                    let data = await this.select(filter);
                    let attach = this.attach();
    
                    if ( typeof attach == 'undefined' )
                        return this;
    
                    let elMap = priv.elementMap.get(this) ?? new WeakMap();
                    let emptyEl = elMap.get(this) ?? [];
    
                    if ( ! elMap.has(this) && attach.empty instanceof Function )
                    {
                        emptyEl = Store.toElement(attach.empty());
                        elMap.set(this, emptyEl);
                        priv.elementMap.set(this, elMap);
                    }
    
                    let target = document.querySelector(attach.target);
                    if ( attach.clear )
                        target.innerHTML = '';
    
                    if ( data.length == 0 )
                    {
                        for (const el of emptyEl)
                            target.append(el);
                    }
                    else
                    {
                        for (const el of emptyEl)
                            el.remove();
                    }
    
                    for (const k in data)
                        this._render(data[k]);
    
                }, 30);
                return this;
            });

            return this;
        }
    };
    let alias = {};
    let statics = {
        default: {
            key: {},
            data: {},
            filter: {},
            api: {},
        },

        toElement: function(str){
            const template = document.createElement('template');
            template.innerHTML = str.trim(); // whitespace 주의
            return Array.from(template.content.children);
        },

        /**
         * 신규 속성으로 기존태그를 덮어씌운다
         * @param {Array<HTMLElement>} 기존
         * @param {Array<HTMLElement>} 신규
         */
        patchElement: function(old, newe){

            if ( ! Array.isArray( old ) )
                old = [old];
            if ( ! Array.isArray( newe ) )
                newe = [newe];

            const len = Math.max(old.length, newe.length);
            for (let i = 0; i < len; i++)
            {
                const oldNode = old[i];
                const newNode = newe[i];

                // 없던 노드 새로 추가 → 상위 요소 필요하므로 무시 또는 핸들링
                if (!oldNode && newNode)
                    continue;
                else if (oldNode && !newNode)
                    oldNode.remove();
                else if (oldNode && newNode)
                    Store._patchSingleElement(oldNode, newNode);
            }
        },

        _patchSingleElement: function(old, newe){
            
            // 타입 다르면 통째로 교체
            if (old.nodeType !== newe.nodeType)
            {
                old.replaceWith(newe);
                return;
            }

            // 텍스트 노드일 경우
            if (old.nodeType === Node.TEXT_NODE && newe.nodeType === Node.TEXT_NODE)
            {
                if (old.nodeValue !== newe.nodeValue)
                    old.nodeValue = newe.nodeValue;
                return;
            }

            // 태그 이름이 다르면 교체
            if (old.nodeName !== newe.nodeName)
            {
                old.replaceWith(newe);
                return;
            }

            // 속성 비교 및 갱신
            // 새 속성 적용
            for (const attr of Array.from(newe.attributes || []))
            {
                if (old.getAttribute(attr.name) !== attr.value)
                    old.setAttribute(attr.name, attr.value);
            }

            // 제거된 속성 삭제
            for (const attr of Array.from(old.attributes || []))
            {
                if (!newe.hasAttribute(attr.name))
                    old.removeAttribute(attr.name);
            }


            // 자식 비교
            const oldChildren = Array.from(old.childNodes);
            const newChildren = Array.from(newe.childNodes);
            const len = Math.max(oldChildren.length, newChildren.length);
            for (let i = 0; i < len; i++)
            {
                const o = oldChildren[i];
                const n = newChildren[i];

                if (!o && n) {
                    old.appendChild(n.cloneNode(true));
                } else if (o && !n) {
                    old.removeChild(o);
                } else if (o && n) {
                    Store._patchSingleElement(o, n); // 재귀
                }
            }

            return old;
        },
    };

    function Store ( config = {} )
    {
        // config 세팅
        config = Object.assign({}, structuredClone( Store.default ), config);
        for (const k in config)
            this[k](config[k]);

        // 데이터 변경 체크용
        let writer = [
            'insert','update','delete',
            'set',
            'data','filter'
        ];

        return new Proxy(this, {
            get ( t, p, r )
            {
                if ( t[p] instanceof Function )
                {
                    return function(... args){

                        let res = t[p](... args);

                        // 실행 후 이벤트 실행
                        if ( p in action )
                            t.dispatch(p, ...args);

                        // 렌더링 다시 적용
                        // TODO: getter는 실행되면안됨, 데이터 변경 감지 구분필요
                        if ( writer.includes(p) )
                        {
                            if ( ! ( p in setup && args.length === 0 ) )
                            {
                                // 렌더 순서맞추기 용
                                // if ( typeof res?.then === 'function' )
                                //     res.then( () => this.render() );
                                // else
                                    this.render();
                            }
                        }
                        return res;
                    };
                }
                    
                return t[p];
            },
        });
    }

    Object.defineProperties(Store, Object.getOwnPropertyDescriptors(statics));
    Object.defineProperties(Store.prototype, Object.getOwnPropertyDescriptors(setup));
    Object.defineProperties(Store.prototype, Object.getOwnPropertyDescriptors(method));
    Object.defineProperties(Store.prototype, Object.getOwnPropertyDescriptors(action));
    Object.defineProperties(Store.prototype, Object.getOwnPropertyDescriptors(alias));

    return { Store };

})));
