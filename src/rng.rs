/// mulberry32 with javascript Math.imul / signed-32 semantics. matches the
/// python implementation in the original almanac.py exactly so seasonal
/// picks are stable across the python and rust versions.

pub struct Mulberry32 {
    state: i32,
}

impl Mulberry32 {
    pub fn new(seed: i64) -> Self {
        Mulberry32 { state: seed as i32 }
    }

    pub fn next(&mut self) -> f64 {
        // s = to_signed32(s + 0x6D2B79F5)
        self.state = self.state.wrapping_add(0x6D2B79F5_u32 as i32);
        // t = imul(s ^ (s >>> 15), 1 | s)
        let s = self.state as u32;
        let mut t = imul(s ^ (s >> 15), 1u32 | s) as i32;
        // t = to_signed32(t + to_signed32(imul(t ^ (t >>> 7), 61 | t)))
        let tu = t as u32;
        let inner = imul(tu ^ (tu >> 7), 61u32 | tu) as i32;
        t = t.wrapping_add(inner);
        // t = t ^ (t >>> 14)
        let tu = t as u32;
        let final_u = tu ^ (tu >> 14);
        final_u as f64 / 4294967296.0
    }
}

#[inline]
fn imul(a: u32, b: u32) -> u32 {
    a.wrapping_mul(b)
}

pub fn pick_items<T: Clone>(items: &[T], count: usize, rng: &mut Mulberry32) -> Vec<T> {
    if items.len() <= count {
        return items.to_vec();
    }
    let mut copy: Vec<T> = items.to_vec();
    let mut out = Vec::with_capacity(count);
    for _ in 0..count {
        let idx = (rng.next() * copy.len() as f64) as usize;
        out.push(copy.remove(idx));
    }
    out
}

pub fn day_hash(date: chrono::DateTime<chrono_tz::Tz>) -> i64 {
    use chrono::Datelike;
    let doy = date.ordinal() as i64;
    date.year() as i64 * 1000 + doy
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_python_seed_2026126() {
        // Captured live from python: seeded_random(2026126) for 10 calls.
        let expected = [
            0.9106675076764077,
            0.03512798482552171,
            0.27484832773916423,
            0.24498416110873222,
            0.6522165813948959,
            0.8708663478028029,
            0.8258189295884222,
            0.6256361070554703,
            0.3541836692020297,
            0.3059297795407474,
        ];
        let mut rng = Mulberry32::new(2026126);
        for (i, &want) in expected.iter().enumerate() {
            let got = rng.next();
            assert!(
                (got - want).abs() < 1e-12,
                "iter {i}: got {got}, want {want}"
            );
        }
    }
}
