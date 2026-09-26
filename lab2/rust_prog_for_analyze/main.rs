fn main() {
    let mut total = 0;

    for i in 0..10 {
        if i % 2 == 0 {
            total += i;
        } else {
            while total < 20 {
                total += 1;

                if total == 15 {
                    break;
                }
            }
        }

        match i {
            0 => total += 1,
            1 => total += 2,
            2 => total += 3,
            _ => total += 0,
        }
    }

    loop {
        if total > 25 {
            break;
        }
        total += 1;
    }
}