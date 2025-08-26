### setup

<script src="index.js"></script>
<script src="store.js"></script>


### usage

// Store 인스턴스 생성
let store = new Store({
    primaryKey: 'id',
    key: {
        group_id: 'group_id'
    }
})


// 데이터 세팅
store.data([
    { id: 1, group_id: 10, name: 'Alice' },
    { id: 2, group_id: 20, name: 'Bob' }
])

// 데이터 삽입
store.insert([
    { id: 1, group_id: 10, name: 'Alice' },
    { id: 2, group_id: 20, name: 'Bob' }
])

// 단순 비교 ($eq)
let user = store.select({
    where: { id: { $eq: 1 } }
})

// 크기 비교 ($gt, $lt)
let youngUsers = store.select({
    where: { age: { $lt: 30 } }
})

// in 조건 ($in)
let groupUsers = store.select({
    where: { group_id: { $in: [10] } }
})

// 조건 + 정렬 + 페이징
let list = store.select({
    where: { group_id: { '$eq': 10} },
    orderby: { name: 'asc' }, // asc | desc
    offset: 0,
    length: 10
})
console.log(list)

// 업데이트
// store.update(데이터, 조건)
store.update({ name: 'Charlie' }, { id: 2 })

// 삭제
store.delete({ id: 1 })
