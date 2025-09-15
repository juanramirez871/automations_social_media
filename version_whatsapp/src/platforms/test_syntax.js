// Ejemplo de JavaScript con diferentes elementos
const message = "¡Hola mundo!";
let number = 42;

function greet(name) {
    return `Hola, ${name}!`;
}

class Person {
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }
    
    introduce() {
        console.log(greet(this.name));
    }
}

// Uso de la clase
const person = new Person("Juan", 25);
person.introduce();

// Array y métodos
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log(doubled);
