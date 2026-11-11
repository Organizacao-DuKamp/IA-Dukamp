export function androidAppLinks(raw = "") {
  const fingerprints = [
    ...new Set(
      raw
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter((value) => /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value)),
    ),
  ];
  return fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: "br.com.tpecia.fazenda",
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : [];
}
