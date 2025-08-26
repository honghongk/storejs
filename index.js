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
 * 
 * 주의: binary_search는 10만건 내외로 해야함, insert가 엄청 느려짐
 * 
 */
(function (global, factory) {

    // 네임스페이스
    global.Store ??= {};

    // 의존성
    let requires = {
    };

    if ( global.constructor.name == 'Window' )
    {
        let lib = factory(requires);
        for (const k in lib)
            global.Store[k] = lib[k];
    }

    if ( typeof exports === 'object' && typeof module !== 'undefined')
        module.exports = factory(requires);
    else if ( typeof define === 'function' && define.amd )
        define(factory);

}(globalThis, (function (req) { 'use strict';


    let priv = {

        // 매핑용 데이터, 타입에 따라 달라짐
        map: new WeakMap(),

        delimiter: new WeakMap(),

        // hash btree 등
        // binary search
        type: new WeakMap(),

        column: new WeakMap(),
        
        unique: new WeakMap(),
    };

    let setup = {

        unique: function(v){
            let unique = priv.unique.get(this);
            if ( arguments.length == 0 )
                return unique;

            if ( typeof v != 'boolean')
                throw new Error(`유니크 여부 세팅값은 boolean 만 가능: ${v}`);

            unique = v;
            priv.unique.set(this, unique);
            return this;
        },
        /**
         * 
         * @param {String|Array} v 
         */
        column: function(v){

            let column = priv.column.get(this);
            if ( arguments.length == 0  )
                return column;

            if ( typeof v == 'string' )
                v = [v];

            for (const c of v) {
                if ( typeof c != 'string' )
                    throw new Error(`컬럼 이름은 문자만 가능: ${c}`);
            }

            column = v;
            priv.column.set(this, column);
            return this;
        },

        map: function(v){
            let map = priv.map.get(this);
            if ( arguments.length == 0 )
                return map;

            map = v;
            priv.map.set(this, map);
            return this;
        },

        /**
         * 키 연결 구분자
         * @param {String} v 
         * @returns {String}
         */
        delimiter: function(v){
            let d = priv.delimiter.get(this);
            if ( arguments.length == 0 )
                return d;

            if ( typeof v == 'string')
                v = [v];

            if ( ! Array.isArray(v) )
                throw new Error('delimiter 문자열 또는 문자열 배열이어야 합니다');

            d = v;
            priv.delimiter.set(this, d);
            return this;
        },

        type: function(v){
            let type = priv.type.get(this);
            if ( arguments.length == 0 )
                return type;

            if ( ! Object.keys(stratege).includes(v) )
                throw new Error(`지원 가능한 타입 아님: ${v}`);

            type = v;
            priv.type.set(this, type);
            return this;
        },
    };

    let stratege = {
        hash: {
            map: {},
            find: function( where, data ) {
                let res = [];
                let map = this.map();
                let column = this.column();
                let delim = this.delimiter();

                // 찾아서 담기
                let kk = column.map(k => where[k]).join(delim);
                res.push( data[map[kk]] );

                return res;
            },
            /**
             * 
             * @param {*} data 
             * @returns 매핑 값
             */
            remap: function( data ) {

                let res = {};
                for (let i = 0; i < data.length; i++)
                {
                    const row = data[i];
                    let rowk = this._getKeyValue(row);

                    if ( uniq )
                    {
                        if ( res[rowk] )
                            throw new Error(`중복된 키: ${rowk}`);
                        res[rowk] = i;
                    }
                    else
                    {
                        if ( ! Array.isArray(res[rowk]) )
                            res[rowk] = [];
                        res[rowk].push(i);
                    }
                }
                
                return res;
            },

            /**
             * 매핑 데이터 있는지 확인 hash
             * @param {*} row 
             * @returns 
             */
            hasMap: function(row) {
                let map = this.map();
                let key = this._getKeyValue(row);
                return typeof map[key] != 'undefined';
            },

            /**
             * 매핑 데이터 세팅
             * @param {*} row row 데이터
             * @param {*} i 입력된 오프셋
             */
            setMap: function(row, i){
                let key = this._getKeyValue(row);
                let map = this.map();

                if ( this.unique() )
                    map[key] = i;
                else
                {
                    if ( ! Array.isArray(map[key] ) )
                        map[key] = [];
                    map[key].push(i);
                }
            },
            /**
             * 매핑 데이터 제거
             * @param {*} row row 데이터
             * @param {*} i 입력된 오프셋
             */
            delMap: function(row, i){
                let key = this._getKeyValue(row);
                let map = this.map();

                if ( this.unique() )
                {
                    if (map[key] === i)
                        delete map[key];
                }
                else
                {
                    if (!Array.isArray(map[key]))
                        return;
                    let idx = map[key].indexOf(i);
                    if (idx !== -1)
                        map[key].splice(idx, 1);
                    if (map[key].length === 0)
                        delete map[key];
                }
            },
        },
        binary_search: {
            map: [],
            /**
             * 
             * @param {*} where 검색조건
             * @param {*} data 전체 데이터
             */
            find: function(where, data) {
                let map = this.map();
                let column = this.column();

                // indexColumn 에 해당하는 조건만 뽑기
                let cond = this._getColumn(where, column);

                // 해당 인덱스 컬럼 조건이 없으면 스킵
                if (!cond)
                    return null;

                // 복합 컬럼이라면 tuple 비교
                let resIndices = [];
                for (let i = 0; i < map.length; i++)
                {
                    let row = data[map[i]];
                    let match = true;

                    for (let col of column)
                    {
                        // 테스트용
                        this._loop++;
                        if (!cond[col])
                            continue;

                        // 같은 컬럼 여러 조건 확인
                        for (let c of cond[col]) {
                            if ( ! this._applyOperator(row[col], Object.keys(c)[0], Object.values(c)[0]) ) {
                                match = false;
                                break;
                            }
                        }

                        if (!match)
                            break;
                    }

                    if (match)
                        resIndices.push(map[i]);
                }

                // resIndices 는 조건을 만족하는 data 인덱스 배열
                return resIndices.map(i => data[i]);
            },
            remap: function( data ) {

                let res = [];
                for (let i = 0; i < data.length; i++)
                {
                    const row = data[i];
                    let rowk = this._getKeyValue(row);

                    // 삽입 위치 찾기
                    let left = 0, right = res.length;
                    while (left < right)
                    {
                        let mid = Math.floor((left + right) / 2);
                        const midKey = this._getKeyValue(data[res[mid]]);
                        if (rowk < midKey)
                            right = mid;
                        else
                            left = mid + 1;
                    }

                    // left가 삽입 위치, 오프셋 추가
                    res.splice(left, 0, i);
                }

                return res;
            },

            /**
             * 매핑 데이터 있는지 확인 binary search
             * @param {*} row 
             * @returns 
             */
            hasMap: function(row) {
                let map = this.map();
                let key = this._getKeyValue(row);
                return map.includes(key); // 배열에 key 존재 여부
            },

            /**
             * 매핑 데이터 세팅
             * @param {*} row row 데이터
             * @param {*} i 입력된 오프셋
             */
            setMap: function(row, i){
                let key = this._getKeyValue(row);
                let map = this.map();

                // 삽입 위치 찾기 (binary search)
                let left = 0, right = map.length;
                while(left < right)
                {
                    let mid = Math.floor((left + right)/2);
                    if(key < map[mid])
                        right = mid;
                    else
                        left = mid + 1;
                }

                map.splice(left, 0, i);
            },

            /**
             * 매핑 데이터 제거
             * @param {*} row row 데이터
             * @param {*} i 입력된 오프셋
             */
            delMap: function(row, i){
                let map = this.map();
                let idx = map.indexOf(i);
                if(idx !== -1)
                    map.splice(idx, 1);
            },
        }
    }

    let method = {

        /**
         * 
         * @param {*} node where 값
         * @param {*} columns 컬럼들 배열
         * @param {*} res kv 오브젝트, 결과로 뺄것
         * @returns 
         */
        _traverse: function(node, columns, res){
            if ( ! node )
                return;

            if ( Array.isArray(node) )
            {
                for (let sub of node)
                    this._traverse(sub, columns, res);
                return;
            }

            for (let key of Object.keys(node))
            {
                if (columns.includes(key))
                {
                    if ( ! res[key] )
                        res[key] = [];
                    let cond = node[key];
                    if (typeof cond !== 'object' || Array.isArray(cond))
                        cond = { '$eq': cond };
                    res[key].push(cond);
                }
                else if (key === '$and' || key === '$or' || key === '$not')
                {
                    this._traverse(node[key], columns, res);
                }
            }
        },

        /**
         * where 에서 해당하는 컬럼만 얻기
         * @param {*} where 
         * @param {*} indexColumn 
         * @returns 
         */
        _getColumn: function(where, indexColumn) {

            let res = {};
            let columnsSet = indexColumn;
            this._traverse(where, columnsSet, res);
            return res;
        },

        /**
         * GPT가 만들어줌, 연산자 처리
         * @param {*} value 
         * @param {*} operator 
         * @param {*} operand 
         * @returns 
         */
        _applyOperator: function(value, operator, operand) {
            switch (operator) {
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
         * 검색조건에 키가 포함되어있는지
         * @param {*} where 
         * @returns 
         */
        _includeKey: function(where) {
            let indexColumns = this.column(); // ['age','group',...]
            let foundCols = {};

            // _traverse 메서드 재활용: 컬럼 발견 시 foundCols에 추가
            this._traverse(where, indexColumns, foundCols);
            
            // 모든 인덱스 컬럼이 발견됐는지 확인
            return indexColumns.every(c => foundCols[c]);
        },

        /**
         * 키에 맞는 데이터들 빼오기
         *  TODO: 지금 값이 문자로 리턴해서 숫자 정렬이 안맞음
         *  복합키에서 해시는 이대로 괜찮고, 이진탐색은 pad 넣어야좋을듯?
         * @param {*} row 
         * @param {*} field 
         * @returns 인덱스 매핑용 value
         */
        _getKeyValue: function(row){
            let res = this.column().map(f => row[f]).join(this.delimiter());
            if ( ! isNaN( res ) )
                res = Number(res);
            return res;
        },

        /**
         * 데이터 매핑되어있는지 확인
         * @param {*} row
         * @returns 
         */
        hasMap: function(row){
            let type = this.type();
            return stratege[type].hasMap.call(this, row);
        },

        /**
         * 매핑 데이터 추가
         * @param {*} row 
         */
        setMap: function(row, i){
            let type = this.type();
            return stratege[type].setMap.call(this, row, i);
        },

        /**
         * 매핑 데이터 제거
         * @param {*} row 
         */
        delMap: function(row, i){
            let type = this.type();
            return stratege[type].delMap.call(this, row, i);
        },

        /**
         * 키로 매핑 데이터 찾기
         */
        find: function(where, data){

            // 테스트용
            this._loop = 0;

            if ( ! this._includeKey(where) )
                return [];

            let type = this.type();
            return stratege[type].find.call(this, where, data);
        },

        /**
         * 매핑 다시하기
         * @param {*} data 
         * @returns 
         */
        remap: function(data){

            // 데이터 없으면 스킵
            if ( ! data || data.length == 0 )
                return this;

            console.time('index remap');

            let type = this.type();
            let newmap =  stratege[type].remap.call(this, data);
            this.map(newmap);

            console.timeEnd('index remap');

            return this;
        },
    };


    let action = {};

    let statics = {
        default: {
            column: [],
            map: {},
            delimiter: ':',
            type: 'binary_search',
            unique: false,
        },
    };


    function Index ( config = {} )
    {
        // normalize
        if (typeof config == 'string')
            config = { column: [config] };
        else if ( Array.isArray(config) )
            config = { column: config };

        // config 세팅
        config = Object.assign({}, structuredClone( Index.default ), config);

        // 타입에 따른 기본 매핑 세팅
        config.map = structuredClone(stratege[config.type].map);
        for (const k in config)
            this[k](config[k]);

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

                        return res;
                    };
                }
                    
                return t[p];
            },
        });
    }

    Object.defineProperties(Index, Object.getOwnPropertyDescriptors(statics));
    Object.defineProperties(Index.prototype, Object.getOwnPropertyDescriptors(setup));
    Object.defineProperties(Index.prototype, Object.getOwnPropertyDescriptors(method));
    Object.defineProperties(Index.prototype, Object.getOwnPropertyDescriptors(action));
    // Object.defineProperties(Index.prototype, Object.getOwnPropertyDescriptors(alias));

    return { Index };

})));
