use std::io;

const MIN_VALUE: i32 = 0;
const MAX_VALUE: i32 = 100;
const DEFAULT_NAME: &str = "Unknown";

#[derive(Debug, Clone)]
struct Student {
    name: String,
    age: u32,
    grades: Vec<i32>,
}

impl Student {
    fn new(name: &str, age: u32, grades: Vec<i32>) -> Self {
        Self {
            name: name.to_string(),
            age,
            grades,
        }
    }

    fn average(&self) -> f64 {
        if self.grades.is_empty() {
            return 0.0;
        }

        let sum: i32 = self.grades.iter().sum();
        sum as f64 / self.grades.len() as f64
    }

    fn max_grade(&self) -> i32 {
        let mut maximum = MIN_VALUE;

        for grade in &self.grades {
            if *grade > maximum {
                maximum = *grade;
            }
        }

        maximum
    }

    fn is_successful(&self) -> bool {
        self.average() >= 60.0
    }
}

fn calculate_sum(numbers: &[i32]) -> i32 {
    let mut sum = 0;

    for number in numbers {
        if *number > MIN_VALUE {
            sum += *number;
        } else {
            sum -= *number;
        }
    }

    sum
}

fn find_max(numbers: &[i32]) -> i32 {
    let mut maximum = MIN_VALUE;

    for number in numbers {
        if *number > maximum {
            maximum = *number;
        }
    }

    maximum
}

fn classify_number(number: i32) -> &'static str {
    match number {
        MIN_VALUE => "zero",
        1..=49 => "small",
        50..=MAX_VALUE => "medium",
        _ => "large",
    }
}

fn main() {
    let numbers = [10, -5, 20, 75, -3, 90];

    let sum = calculate_sum(&numbers);
    let maximum = find_max(&numbers);
    let category = classify_number(maximum);

    let student = Student::new(
        DEFAULT_NAME,
        20,
        vec![75, 82, 91, 68, 55],
    );

    println!("Numbers: {:?}", numbers);
    println!("Sum: {}", sum);
    println!("Maximum: {}", maximum);
    println!("Category: {}", category);

    println!("Student: {:?}", student);
    println!("Name: {}", student.name);
    println!("Age: {}", student.age);
    println!("Average: {:.2}", student.average());
    println!("Maximum grade: {}", student.max_grade());

    if student.is_successful() {
        println!("Student passed the exam");
    } else {
        println!("Student failed the exam");
    }

    let result = match student.average() {
        value if value >= 90.0 => "excellent",
        value if value >= 75.0 => "good",
        value if value >= 60.0 => "satisfactory",
        _ => "unsatisfactory",
    };

    println!("Result: {}", result);

    let _input = io::stdin();
}