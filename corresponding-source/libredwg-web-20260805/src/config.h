/* config.h - Emscripten WASM build config for LibreDWG 0.14 */
#ifndef CONFIG_H
#define CONFIG_H

/* Package */
#define PACKAGE "LibreDWG"
#define PACKAGE_NAME "LibreDWG"
#define PACKAGE_VERSION "0.14"
#define LIBREDWG_SO_VERSION "0:14:0"

/* Standard headers */
#define HAVE_STDDEF_H 1
#define HAVE_STDLIB_H 1
#define HAVE_STRING_H 1
#define HAVE_STRINGS_H 1
#define HAVE_INTTYPES_H 1
#define HAVE_STDINT_H 1
#define HAVE_LIMITS_H 1
#define HAVE_FLOAT_H 1
#define HAVE_CTYPE_H 1
#define HAVE_WCHAR_H 1
#define HAVE_WCTYPE_H 1
#define HAVE_MALLOC_H 1
#define HAVE_MEMORY_H 1
#define HAVE_UNISTD_H 1
#define HAVE_SYS_STAT_H 1
#define HAVE_DIRENT_H 1
#define HAVE_ENDIAN_H 1
#define HAVE_ALLOCA_H 1

/* Functions */
#define HAVE_FLOOR 1
#define HAVE_GETTIMEOFDAY 1
#define HAVE_MEMCHR 1
#define HAVE_MEMMEM 1
#define HAVE_STRTOULL 1
#define HAVE_GMTIME_R 1
#define HAVE_SINCOS 0

/* No iconv - use built-in codepage conversion */
/* #undef HAVE_ICONV_H */
/* #undef HAVE_ICONV */

/* No libgen.h */
/* #undef HAVE_LIBGEN_H */

/* GNU extensions */
#define HAVE_FUNC_ATTRIBUTE_MALLOC 1
#define HAVE_FUNC_ATTRIBUTE_NORETURN 1
#define HAVE_FUNC_ATTRIBUTE_RETURNS_NONNULL 1

/* WCHAR - Emscripten uses 32-bit wchar, not UCS-2 */
/* #undef HAVE_NATIVE_WCHAR2 */

/* Alignment */
/* #undef HAVE_ALIGNED_ACCESS_REQUIRED */

/* Compression */
#define HAVE_ZLIB_H 1

/* Endianness - wasm is little-endian */
/* #undef WORDS_BIGENDIAN */

/* strnlen */
/* #undef HAVE_STRNLEN */

#endif
