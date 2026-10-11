# Where 9/4 Comes From

An interactive web page that explains, at a high school level, where the number 9/4 comes from in OpenAI's October 2026 proof that the matrix multiplication exponent satisfies omega <= 9/4.

Live page: https://hrishik.me/understand-matmul/

## What the page covers

The page builds the whole argument from school algebra. Each chapter has an interactive figure and a short quiz.

1. The school method and its n^3 cost.
1. Strassen's seven products and the recursion rule.
1. Multiplication tasks as 3D shapes (tensors), rank, and dot products.
1. Polynomial multiplication and the evaluation trick (the ceiling).
1. Squishing tasks: restrictions, degenerations, and the power trick.
1. Meters (tensor characters) and Strassen's bridge.
1. The paper's new idea: separating a shared tensor leg with a clock filter and a perfect-square weight.
1. Rule C: the determinant split that makes the score bend.
1. Rule T: tripling with a small tax.
1. The squeeze that forces the meter level t <= 3/4.
1. The anatomy of 9/4, a thought experiment on the tax, and a rule checker.

## Simplifications

The main text assumes balanced meters (swapping legs does not change a reading) and proves the shared-leg rule for equal pieces. Fine-print boxes on the page explain how the paper removes both simplifications.

## Sources

- OpenAI, *An Upper Bound of 9/4 for the Matrix Multiplication Exponent*, October 2, 2026, in [openai/math](https://github.com/openai/math) (entry 107).
- The extremal profile P* in Chapter 11 is from community follow-up work: [acprk/openai-math-followups](https://github.com/acprk/openai-math-followups). It is not part of the paper.

## Running locally

The site is static. Serve the folder with any web server, for example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. MathJax and the fonts load from public CDNs.
