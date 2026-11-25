fn main() {
    let base = 5;          
    let mut extra = 0;        
    let limit = 10;           
    let unused = 99;          
    
    let result = base + extra; 

    for i in 0..limit {
        if i < base {
            extra += 1;
        }
    }


    println!("{} {} {}", result, extra, base);
}