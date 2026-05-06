use chrono::{DateTime, Datelike, Duration, TimeZone, Timelike, Utc};
use chrono_tz::Tz;

const LAT: f64 = 35.78;
const LON: f64 = -78.64;
const SYNODIC_MONTH: f64 = 29.53058867;

fn julian_day(dt_utc: DateTime<Utc>) -> f64 {
    let mut y = dt_utc.year();
    let mut m = dt_utc.month() as i32;
    let d = dt_utc.day() as f64
        + (dt_utc.hour() as f64
            + (dt_utc.minute() as f64 + dt_utc.second() as f64 / 60.0) / 60.0)
            / 24.0;
    if m <= 2 {
        y -= 1;
        m += 12;
    }
    let a = (y as f64 / 100.0).floor() as i32;
    let b = 2 - a + (a as f64 / 4.0).floor() as i32;
    (365.25 * (y as f64 + 4716.0)).floor()
        + (30.6001 * (m as f64 + 1.0)).floor()
        + d
        + b as f64
        - 1524.5
}

/// (age in days, illumination 0..1)
fn moon_state(date: DateTime<Tz>) -> (f64, f64) {
    let dt_utc = date.with_timezone(&Utc);
    let t = (julian_day(dt_utc) - 2451545.0) / 36525.0;
    let d = (297.8501921_f64 + 445267.1114034 * t).rem_euclid(360.0);
    let ms = (357.5291092_f64 + 35999.0502909 * t).rem_euclid(360.0);
    let mm = (134.9633964_f64 + 477198.8675055 * t).rem_euclid(360.0);
    let f = (93.2720950_f64 + 483202.0175233 * t).rem_euclid(360.0);
    let dr = d.to_radians();
    let msr = ms.to_radians();
    let mmr = mm.to_radians();
    let fr = f.to_radians();
    let dl_moon = 6.288774 * mmr.sin()
        + 1.274027 * (2.0 * dr - mmr).sin()
        + 0.658314 * (2.0 * dr).sin()
        + 0.213618 * (2.0 * mmr).sin()
        - 0.185116 * msr.sin()
        - 0.114332 * (2.0 * fr).sin()
        + 0.058793 * (2.0 * dr - 2.0 * mmr).sin()
        + 0.057066 * (2.0 * dr - msr - mmr).sin()
        + 0.053322 * (2.0 * dr + mmr).sin()
        + 0.045758 * (2.0 * dr - msr).sin()
        - 0.040923 * (msr - mmr).sin()
        - 0.034720 * dr.sin()
        - 0.030383 * (msr + mmr).sin();
    let dl_sun = 1.914602 * msr.sin()
        + 0.019993 * (2.0 * msr).sin()
        + 0.000289 * (3.0 * msr).sin();
    let elong = (d + dl_moon - dl_sun).rem_euclid(360.0);
    let age = elong / 360.0 * SYNODIC_MONTH;
    let illum = (1.0 - elong.to_radians().cos()) / 2.0;
    (age, illum)
}

pub fn moon_phase(date: DateTime<Tz>) -> f64 {
    moon_state(date).0
}

pub fn moon_illumination(date: DateTime<Tz>) -> f64 {
    moon_state(date).1
}

pub fn moon_name(phase: f64) -> &'static str {
    if phase < 1.85 {
        "new moon"
    } else if phase < 7.38 {
        "waxing crescent"
    } else if phase < 9.23 {
        "first quarter"
    } else if phase < 14.77 {
        "waxing gibbous"
    } else if phase < 16.61 {
        "full moon"
    } else if phase < 22.15 {
        "waning gibbous"
    } else if phase < 23.99 {
        "last quarter"
    } else if phase < 27.68 {
        "waning crescent"
    } else {
        "new moon"
    }
}

fn is_leap(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

/// (sunrise local hours, sunset local hours, day length hours).
/// uses NOAA Spencer fourier series; accounts for longitude, equation of
/// time, atmospheric refraction; converts to local-tz of `local_date`.
pub fn sun_times(local_date: DateTime<Tz>) -> (f64, f64, f64) {
    let year = local_date.year();
    let doy = local_date.ordinal() as i32;
    let year_len = if is_leap(year) { 366.0 } else { 365.0 };
    let gamma = (2.0 * std::f64::consts::PI / year_len) * (doy as f64 - 1.0);

    let eot = 229.18
        * (0.000075 + 0.001868 * gamma.cos()
            - 0.032077 * gamma.sin()
            - 0.014615 * (2.0 * gamma).cos()
            - 0.040849 * (2.0 * gamma).sin());

    let decl = 0.006918 - 0.399912 * gamma.cos()
        + 0.070257 * gamma.sin()
        - 0.006758 * (2.0 * gamma).cos()
        + 0.000907 * (2.0 * gamma).sin()
        - 0.002697 * (3.0 * gamma).cos()
        + 0.001480 * (3.0 * gamma).sin();

    let lat_rad = LAT.to_radians();
    let mut cos_ha = (90.833_f64.to_radians().cos() - lat_rad.sin() * decl.sin())
        / (lat_rad.cos() * decl.cos());
    cos_ha = cos_ha.clamp(-1.0, 1.0);
    let ha = cos_ha.acos().to_degrees();

    let solar_noon_min = 720.0 - 4.0 * LON - eot;
    let sr_min = solar_noon_min - 4.0 * ha;
    let ss_min = solar_noon_min + 4.0 * ha;

    let tz = local_date.timezone();
    let base = Utc
        .with_ymd_and_hms(year, local_date.month(), local_date.day(), 0, 0, 0)
        .unwrap();

    let sr = (base + Duration::nanoseconds((sr_min * 60.0 * 1e9) as i64)).with_timezone(&tz);
    let ss = (base + Duration::nanoseconds((ss_min * 60.0 * 1e9) as i64)).with_timezone(&tz);

    let sr_h = sr.hour() as f64 + sr.minute() as f64 / 60.0 + sr.second() as f64 / 3600.0;
    let ss_h = ss.hour() as f64 + ss.minute() as f64 / 60.0 + ss.second() as f64 / 3600.0;

    (sr_h, ss_h, (ss_min - sr_min) / 60.0)
}

pub fn format_hm(hours: f64) -> String {
    let h = hours.trunc() as i64;
    let m = ((hours - h as f64) * 60.0).round() as i64;
    format!("{h}h {m}m")
}

pub fn format_clock(hours: f64) -> String {
    let mut h = hours.trunc() as i64;
    let mut m = ((hours - h as f64) * 60.0).round() as i64;
    if m == 60 {
        h += 1;
        m = 0;
    }
    let suffix = if h >= 12 { "pm" } else { "am" };
    let display = if h > 12 {
        h - 12
    } else if h == 0 {
        12
    } else {
        h
    };
    format!("{display}:{m:02} {suffix}")
}

pub fn sky_data_lines(now: DateTime<Tz>) -> Vec<String> {
    let phase = moon_phase(now);
    let name = moon_name(phase);
    let illum = (moon_illumination(now) * 100.0).round() as i64;
    let (sunrise, sunset, hours) = sun_times(now);
    let yesterday = now - Duration::days(1);
    let gained = (hours - sun_times(yesterday).2) * 60.0;
    let sign = if gained > 0.0 { "+" } else { "" };
    vec![
        format!("<strong>{name}</strong>, {illum}% lit"),
        format!(
            "sunrise <strong>{}</strong> \u{00b7} sunset <strong>{}</strong>",
            format_clock(sunrise),
            format_clock(sunset)
        ),
        format!(
            "<strong>{}</strong> of daylight ({sign}{:.1} minutes from yesterday)",
            format_hm(hours),
            gained
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono_tz::America::New_York;

    fn fixed_now() -> DateTime<Tz> {
        New_York.with_ymd_and_hms(2026, 5, 6, 19, 0, 0).unwrap()
    }

    #[test]
    fn moon_matches_python() {
        let now = fixed_now();
        let phase = moon_phase(now);
        let illum = moon_illumination(now);
        assert!((phase - 19.474334776875626).abs() < 1e-9, "phase={phase}");
        assert!((illum - 0.7693359060289093).abs() < 1e-9, "illum={illum}");
        assert_eq!(moon_name(phase), "waning gibbous");
    }

    #[test]
    fn sun_matches_python() {
        let now = fixed_now();
        let (sr, ss, hours) = sun_times(now);
        assert!((sr - 6.298611111111111).abs() < 1e-6, "sr={sr}");
        assert!((ss - 20.067777777777778).abs() < 1e-6, "ss={ss}");
        assert!((hours - 13.768966853824192).abs() < 1e-9, "hours={hours}");
    }
}
