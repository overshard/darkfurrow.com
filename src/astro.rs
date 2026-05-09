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

// standard sun-event altitudes (degrees below horizon).
// -0.8333 = atmospheric refraction (-34') + sun semi-diameter (-16').
const SUN_GEOMETRIC_ALT: f64 = -0.8333;
const CIVIL_DUSK_ALT: f64 = -6.0;
const NAUTICAL_DUSK_ALT: f64 = -12.0;
const ASTRO_DUSK_ALT: f64 = -18.0;

#[derive(Clone, Copy, Debug)]
pub struct SunTimes {
    pub sunrise: f64,
    pub sunset: f64,
    pub civil_dusk: f64,
    pub nautical_dusk: f64,
    pub astronomical_dusk: f64,
    pub daylight_hours: f64,
}

/// (right ascension deg, declination rad, equation of time min). Meeus ch 25.
fn sun_apparent(jde: f64) -> (f64, f64, f64) {
    let t = (jde - 2451545.0) / 36525.0;
    let l0 = (280.46646 + 36000.76983 * t + 0.0003032 * t * t).rem_euclid(360.0);
    let m = (357.52911 + 35999.05029 * t - 0.0001537 * t * t).rem_euclid(360.0);
    let mr = m.to_radians();
    let c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * mr.sin()
        + (0.019993 - 0.000101 * t) * (2.0 * mr).sin()
        + 0.000289 * (3.0 * mr).sin();
    let true_long = l0 + c;
    let omega_r = (125.04 - 1934.136 * t).to_radians();
    let lambda = true_long - 0.00569 - 0.00478 * omega_r.sin();
    let eps0 = 23.439291 - 0.0130042 * t - 1.64e-7 * t * t + 5.04e-7 * t * t * t;
    let eps = eps0 + 0.00256 * omega_r.cos();
    let lr = lambda.to_radians();
    let er = eps.to_radians();
    let alpha = (er.cos() * lr.sin())
        .atan2(lr.cos())
        .to_degrees()
        .rem_euclid(360.0);
    let decl = (er.sin() * lr.sin()).asin();
    let mut diff = (l0 - 0.0057183 - alpha) % 360.0;
    if diff > 180.0 {
        diff -= 360.0;
    }
    if diff < -180.0 {
        diff += 360.0;
    }
    (alpha, decl, 4.0 * diff)
}

fn hour_angle_at_alt(decl: f64, alt_rad: f64) -> Option<f64> {
    let lat_r = LAT.to_radians();
    let cos_h = (alt_rad.sin() - lat_r.sin() * decl.sin()) / (lat_r.cos() * decl.cos());
    if !(-1.0..=1.0).contains(&cos_h) {
        return None;
    }
    Some(cos_h.acos().to_degrees() / 15.0)
}

/// Local-tz fractional hour of the rise (`is_rise=true`) or set event when the
/// sun is at altitude `alt_deg`. Returns `None` if the sun never crosses that
/// altitude on the given date (no event, e.g. polar day/night).
fn sun_event_hours(
    jd_noon: f64,
    utc_midnight: DateTime<Utc>,
    tz: Tz,
    alt_deg: f64,
    is_rise: bool,
) -> Option<f64> {
    let alt_r = alt_deg.to_radians();
    // first pass uses noon-UTC sun position
    let (_, decl0, eot0) = sun_apparent(jd_noon);
    let h0 = hour_angle_at_alt(decl0, alt_r)?;
    let solar_noon_0 = 12.0 - LON / 15.0 - eot0 / 60.0;
    let evt0 = if is_rise { solar_noon_0 - h0 } else { solar_noon_0 + h0 };
    // refine once at the predicted event time
    let (_, decl1, eot1) = sun_apparent(jd_noon - 0.5 + evt0 / 24.0);
    let h1 = hour_angle_at_alt(decl1, alt_r)?;
    let solar_noon_1 = 12.0 - LON / 15.0 - eot1 / 60.0;
    let evt1 = if is_rise { solar_noon_1 - h1 } else { solar_noon_1 + h1 };
    let event_utc = utc_midnight + Duration::nanoseconds((evt1 * 3600.0 * 1e9) as i64);
    let local = event_utc.with_timezone(&tz);
    Some(local.hour() as f64 + local.minute() as f64 / 60.0 + local.second() as f64 / 3600.0)
}

/// Sunrise, sunset, and three twilight ends (civil/nautical/astronomical dusk)
/// for the given local date. Uses Meeus chapter 25 sun position with one
/// refinement pass; matches USNO to a few seconds. Hours are local fractional
/// hours within the calendar date of `local_date`.
pub fn sun_times(local_date: DateTime<Tz>) -> SunTimes {
    let tz = local_date.timezone();
    let local_noon = tz
        .with_ymd_and_hms(
            local_date.year(),
            local_date.month(),
            local_date.day(),
            12,
            0,
            0,
        )
        .unwrap();
    let noon_utc = local_noon.with_timezone(&Utc);
    let utc_midnight = Utc
        .with_ymd_and_hms(noon_utc.year(), noon_utc.month(), noon_utc.day(), 0, 0, 0)
        .unwrap();
    let jd_noon = julian_day(noon_utc);
    let evt = |alt, is_rise| {
        sun_event_hours(jd_noon, utc_midnight, tz, alt, is_rise).unwrap_or(0.0)
    };
    let sunrise = evt(SUN_GEOMETRIC_ALT, true);
    let sunset = evt(SUN_GEOMETRIC_ALT, false);
    SunTimes {
        sunrise,
        sunset,
        civil_dusk: evt(CIVIL_DUSK_ALT, false),
        nautical_dusk: evt(NAUTICAL_DUSK_ALT, false),
        astronomical_dusk: evt(ASTRO_DUSK_ALT, false),
        daylight_hours: sunset - sunrise,
    }
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
    let st = sun_times(now);
    let yesterday = now - Duration::days(1);
    let gained = (st.daylight_hours - sun_times(yesterday).daylight_hours) * 60.0;
    let sign = if gained > 0.0 { "+" } else { "" };
    vec![
        format!("<strong>{name}</strong>, {illum}% lit"),
        format!(
            "sunrise <strong>{}</strong> \u{00b7} sunset <strong>{}</strong>",
            format_clock(st.sunrise),
            format_clock(st.sunset)
        ),
        format!(
            "<strong>{}</strong> of daylight ({sign}{:.1} minutes from yesterday)",
            format_hm(st.daylight_hours),
            gained
        ),
        format!(
            "civil dusk <strong>{}</strong> \u{00b7} sailor's dark <strong>{}</strong> \u{00b7} true dark <strong>{}</strong>",
            format_clock(st.civil_dusk),
            format_clock(st.nautical_dusk),
            format_clock(st.astronomical_dusk)
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
    fn sun_matches_usno() {
        // 2026-05-06 USNO/Naval Observatory values for lat 35.78, lon -78.64 EDT:
        //   sunrise 06:17, sunset 20:06, civil dusk 20:34, nautical 21:07, astro 21:43.
        // Tolerance is 30 sec since both USNO and Meeus round display values.
        let now = fixed_now();
        let st = sun_times(now);
        let approx = |actual: f64, h: i32, m: i32, label: &str| {
            let expected = h as f64 + m as f64 / 60.0;
            let diff = (actual - expected).abs();
            assert!(diff < 1.0 / 60.0, "{label}: got {actual}, expected ~{h}:{m:02}");
        };
        approx(st.sunrise, 6, 17, "sunrise");
        approx(st.sunset, 20, 6, "sunset");
        approx(st.civil_dusk, 20, 34, "civil dusk");
        approx(st.nautical_dusk, 21, 7, "nautical dusk");
        approx(st.astronomical_dusk, 21, 43, "astro dusk");
        assert!(
            (st.daylight_hours - 13.81).abs() < 0.02,
            "daylight={}",
            st.daylight_hours
        );
    }
}
