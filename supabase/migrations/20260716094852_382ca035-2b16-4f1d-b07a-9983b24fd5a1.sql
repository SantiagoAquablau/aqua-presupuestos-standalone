-- Corregir la fórmula de MASSÍS GRIS 40x20x5 perquè torni a aparèixer amb
-- els mateixos tipus d'escala que BORDILLO JARDIN 1M: mateixa estructura de
-- càlcul, però activada quan el revestiment és porcelànic. Abans utilitzava
-- ext_stair_width (0 per a escales interiors) i 'estandar' (mala grafia), fet
-- que provocava que la partida no es generés en pràcticament cap escenari.
UPDATE public.formula_rules
SET formula_quantity = $$ifVal(interior_stair_type === "sense", 0,
    ifVal(interior_stair_type === 'banc',
        bench_width + stairs_width * (pool_depth_min / 0.2),
        ifVal(interior_stair_type === 'plataforma',
            platform_width + stairs_width * (pool_depth_min / 0.2),
            ifVal(interior_stair_type === 'estandard',
                roundUp((stairs_width * (pool_depth_min / 0.2)) / 2, 0),
                ifVal(interior_stair_type === 'tot_ample',
                    pool_width * (pool_depth_min / 0.2),
                    0
                )
            )
        )
    )
)$$
WHERE id = '2e97d0aa-a055-4b37-9aa6-b3bf3671df9a';